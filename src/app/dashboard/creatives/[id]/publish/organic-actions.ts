"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/crypto";
import { getCampaignProvider } from "@/lib/ads";
import { publishPhotoToPage, getPageAccessToken } from "@/lib/ads/organic-publish";

export type OrganicPostState =
  | { status: "idle" }
  | { status: "success"; postId: string; permalink: string | null }
  | { status: "error"; message: string };

/**
 * Posts a ready creative directly to a connected Meta Page's feed — no
 * budget, no approval gate, same as a manual post in Meta Business Suite.
 * Requires the Page connection to carry pages_manage_posts scope; a scope
 * error surfaces the exact Graph API message so the user knows what to
 * reconnect.
 */
export async function postOrganic(
  _prev: OrganicPostState,
  formData: FormData,
): Promise<OrganicPostState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const creativeId = String(formData.get("creativeId") ?? "");
  const adAccountId = String(formData.get("adAccountId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();

  if (!creativeId || !adAccountId) {
    return { status: "error", message: "Missing creative or ad account." };
  }

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, creativeId), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative || creative.status !== "ready" || !creative.assetUrl) {
    return { status: "error", message: "Creative isn't ready yet." };
  }

  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(and(eq(schema.adAccounts.id, adAccountId), eq(schema.adAccounts.orgId, org.id)))
    .limit(1);
  if (!adAccount?.encryptedToken) {
    return { status: "error", message: "Ad account not connected." };
  }

  try {
    const token = decryptSecret(adAccount.encryptedToken);
    const acctMeta = (adAccount.meta ?? {}) as Record<string, unknown>;
    let pageId = acctMeta.pageId ? String(acctMeta.pageId) : "";
    if (!pageId) {
      const provider = getCampaignProvider(adAccount.platform);
      const pages = await provider.listPages(token);
      if (pages.length === 0) {
        return {
          status: "error",
          message: "No Facebook Page found on this connection. Reconnect Meta granting Page access.",
        };
      }
      pageId = pages[0].id;
    }

    const pageToken = await getPageAccessToken(token, pageId);
    const imageUrl = `/api/creatives/${creative.id}?size=square&download=1`;
    const absoluteUrl = new URL(imageUrl, process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").href;

    const result = await publishPhotoToPage({
      pageId,
      pageAccessToken: pageToken,
      imageUrl: absoluteUrl,
      caption: caption || (creative.meta as { headline?: string })?.headline || "",
    });

    await db.insert(schema.auditLog).values({
      orgId: org.id,
      actor: "user",
      action: "organic_post",
      payload: { creativeId, pageId, postId: result.postId },
    });

    return { status: "success", postId: result.postId, permalink: result.permalink };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 300) : "Posting failed",
    };
  }
}
