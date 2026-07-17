import { and, eq, lte } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/crypto";
import { getCampaignProvider } from "@/lib/ads";
import { publishPhotoToPage, getPageAccessToken } from "@/lib/ads/organic-publish";

/**
 * Publishes due scheduled organic posts to a connected Meta Page.
 *
 * Runs every 5 minutes (and on demand via `scheduled/publish.requested`). For
 * each org that has due posts (status "scheduled", scheduledFor <= now) it
 * resolves the org's connected Page once, then publishes each post.
 *
 * Gating (per the approved scope — nothing auto-fires unsafely):
 *  - An org with NO connected ad account is skipped entirely; its posts stay
 *    "scheduled" and publish as soon as a Page is connected.
 *  - A post with no image (neither imageUrl nor a linked creative) is marked
 *    "failed" rather than posted blank.
 *  - Each post is flipped to "publishing" before the network call so a second
 *    tick won't double-post the same row.
 */
export const publishScheduledPosts = inngest.createFunction(
  {
    id: "publish-scheduled-posts",
    name: "Publish scheduled posts",
    retries: 1,
    triggers: [{ cron: "*/5 * * * *" }, { event: "scheduled/publish.requested" }],
  },
  async ({ step }) => {
    const now = new Date();
    const due = await db
      .select()
      .from(schema.scheduledPosts)
      .where(
        and(
          eq(schema.scheduledPosts.status, "scheduled"),
          lte(schema.scheduledPosts.scheduledFor, now),
        ),
      )
      .limit(50);

    if (due.length === 0) return { published: 0, failed: 0, skipped: 0 };

    // Group due posts by org so we resolve each Page connection once.
    const byOrg = new Map<string, typeof due>();
    for (const post of due) {
      const list = byOrg.get(post.orgId) ?? [];
      list.push(post);
      byOrg.set(post.orgId, list);
    }

    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const [orgId, posts] of byOrg) {
      // Resolve the org's Page token once (or skip the org if not connected).
      const conn = await step.run(`resolve-page-${orgId}`, async () => {
        const [adAccount] = await db
          .select()
          .from(schema.adAccounts)
          .where(
            and(
              eq(schema.adAccounts.orgId, orgId),
              eq(schema.adAccounts.status, "connected"),
            ),
          )
          .limit(1);
        if (!adAccount?.encryptedToken) return null;

        const token = decryptSecret(adAccount.encryptedToken);
        const acctMeta = (adAccount.meta ?? {}) as Record<string, unknown>;
        let pageId = acctMeta.pageId ? String(acctMeta.pageId) : "";
        if (!pageId) {
          const provider = getCampaignProvider(adAccount.platform);
          const pages = await provider.listPages(token);
          if (pages.length === 0) return null;
          pageId = pages[0].id;
        }
        const pageToken = await getPageAccessToken(token, pageId);
        return { pageId, pageToken };
      });

      if (!conn) {
        skipped += posts.length;
        continue; // leave posts "scheduled" — they'll publish once a Page connects
      }

      for (const post of posts) {
        // Claim the row so a concurrent tick can't double-post it.
        await db
          .update(schema.scheduledPosts)
          .set({ status: "publishing", updatedAt: new Date() })
          .where(eq(schema.scheduledPosts.id, post.id));

        const imageUrl =
          post.imageUrl ??
          (post.creativeId
            ? new URL(`/api/creatives/${post.creativeId}?size=square&download=1`, appUrl).href
            : null);

        if (!imageUrl) {
          await db
            .update(schema.scheduledPosts)
            .set({ status: "failed", error: "Post has no image to publish.", updatedAt: new Date() })
            .where(eq(schema.scheduledPosts.id, post.id));
          failed++;
          continue;
        }

        try {
          const result = await publishPhotoToPage({
            pageId: conn.pageId,
            pageAccessToken: conn.pageToken,
            imageUrl,
            caption: post.caption,
          });
          await db
            .update(schema.scheduledPosts)
            .set({
              status: "published",
              postId: result.postId,
              permalink: result.permalink,
              publishedAt: new Date(),
              error: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.scheduledPosts.id, post.id));
          await db.insert(schema.auditLog).values({
            orgId,
            actor: "ai",
            action: "scheduled_post_published",
            payload: { scheduledPostId: post.id, pageId: conn.pageId, postId: result.postId },
          });
          published++;
        } catch (err) {
          await db
            .update(schema.scheduledPosts)
            .set({
              status: "failed",
              error: err instanceof Error ? err.message.slice(0, 300) : "Publish failed",
              updatedAt: new Date(),
            })
            .where(eq(schema.scheduledPosts.id, post.id));
          failed++;
        }
      }
    }

    return { published, failed, skipped };
  },
);
