"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BriefInput } from "@/lib/ai/strategist";
import { inngest } from "@/inngest/client";
import { getCampaignProvider } from "@/lib/ads";
import { upsertDailySnapshot } from "@/lib/ads/metrics-store";
import { decryptSecret } from "@/lib/crypto";

function clean(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

export async function createCampaignFromBrief(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const productName = clean(formData, "productName");
  const goal = clean(formData, "goal");
  if (!productName || !goal) {
    redirect(
      "/dashboard/campaigns/new?error=" +
        encodeURIComponent("Product name and campaign goal are required"),
    );
  }

  // Brand voice from the selected profile — the strategist writes strategy and
  // copy in this voice; tone/color/logo come from the (prefilled, editable)
  // form fields so per-campaign overrides win.
  const brandProfileId = clean(formData, "brandProfileId");
  let brandName: string | null = null;
  let brandDescription: string | null = null;
  if (brandProfileId) {
    const [bp] = await db
      .select({
        name: schema.brandProfiles.name,
        description: schema.brandProfiles.description,
      })
      .from(schema.brandProfiles)
      .where(
        and(
          eq(schema.brandProfiles.id, brandProfileId),
          eq(schema.brandProfiles.orgId, org.id),
        ),
      )
      .limit(1);
    if (bp) {
      brandName = bp.name;
      brandDescription = bp.description;
    }
  }

  const brief: BriefInput = {
    productName,
    productDescription: clean(formData, "productDescription"),
    goal,
    audience: clean(formData, "audience"),
    budget: clean(formData, "budget"),
    tone: clean(formData, "tone"),
    brandName,
    brandDescription,
    brandColor: clean(formData, "brandColor"),
    websiteUrl: clean(formData, "websiteUrl"),
    destination:
      clean(formData, "destination") === "whatsapp" ? "whatsapp" : "website",
    geoCountries: clean(formData, "geoCountries"),
    language: clean(formData, "language"),
    dialect: clean(formData, "dialect"),
  };

  const brandVisuals = {
    primaryColor: clean(formData, "brandColor"),
    logoUrl: clean(formData, "logoUrl"),
    photoUrl: clean(formData, "photoUrl"),
  };

  // 1. Resolve the product being marketed: reuse the selected catalog product
  //    (refreshing its brand visuals), or create a new one — tied to the brand
  //    so it joins the catalog for future campaigns and creatives.
  const selectedProductId = clean(formData, "productId");
  let product: typeof schema.products.$inferSelect | undefined;

  if (selectedProductId) {
    const [existing] = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.id, selectedProductId),
          eq(schema.products.orgId, org.id),
        ),
      )
      .limit(1);
    if (existing) {
      const prevBrand = (existing.brand ?? {}) as Record<string, unknown>;
      [product] = await db
        .update(schema.products)
        .set({
          description: brief.productDescription ?? existing.description,
          targetAudience: brief.audience ?? existing.targetAudience,
          brand: { ...prevBrand, ...brandVisuals },
        })
        .where(eq(schema.products.id, existing.id))
        .returning();
    }
  }

  if (!product) {
    [product] = await db
      .insert(schema.products)
      .values({
        orgId: org.id,
        brandProfileId: brandProfileId ?? null,
        name: productName,
        description: brief.productDescription,
        targetAudience: brief.audience,
        brand: brandVisuals,
      })
      .returning();
  }

  // 2. Create the campaign immediately as a draft holding the brief. The heavy
  //    agent work (research → strategy → creatives → launch gate) runs in a
  //    background job so this returns instantly; the page shows "researching…".
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      orgId: org.id,
      productId: product.id,
      platform: "meta",
      name: `${productName} — ${goal}`.slice(0, 120),
      objective: goal,
      status: "draft",
      brief,
    })
    .returning();

  try {
    await inngest.send({
      name: "campaign/generate.requested",
      data: { campaignId: campaign.id, userId: user.id },
    });
  } catch (err) {
    console.error("Failed to enqueue campaign generation:", err);
  }

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaign.id}`);
}

/**
 * Import existing campaigns from a connected Meta ad account: pulls each
 * campaign, its primary ad set (id + budget), and the last 7 days of daily
 * metrics — so the AI optimizer can run on your real, live campaigns.
 */
export async function importMetaCampaigns(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const adAccountId = String(formData.get("adAccountId") ?? "");
  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(
      and(eq(schema.adAccounts.id, adAccountId), eq(schema.adAccounts.orgId, org.id)),
    )
    .limit(1);
  if (!adAccount?.encryptedToken) {
    redirect(
      "/dashboard/campaigns?error=" +
        encodeURIComponent("Connect an ad account first"),
    );
  }

  const provider = getCampaignProvider(adAccount.platform);
  const token = decryptSecret(adAccount.encryptedToken);
  // Use the ad account's real currency (Meta reports money in it), not a hardcode.
  const acctCurrency =
    ((adAccount.meta ?? {}) as { currency?: string }).currency ?? "MAD";
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  let imported = 0;
  try {
    const acctCreds = { externalId: adAccount.externalId, accessToken: token };

    // Two API calls total regardless of campaign count:
    // 1. campaigns + their primary ad sets (inline adsets field)
    // 2. all campaign daily insights at account level in one shot
    const [remote, insightsBatch] = await Promise.all([
      provider.listCampaigns(acctCreds),
      provider.getAccountDailyInsightsBatch(acctCreds, since, until),
    ]);

    const existing = await db
      .select()
      .from(schema.campaigns)
      .where(
        and(
          eq(schema.campaigns.orgId, org.id),
          eq(schema.campaigns.platform, adAccount.platform),
        ),
      );
    const existingMetaIds = new Set(
      existing
        .map(
          (c) => (c.externalIds as Record<string, string>)?.[adAccount.platform],
        )
        .filter(Boolean),
    );

    for (const rc of remote.slice(0, 25)) {
      if (existingMetaIds.has(rc.externalId)) continue;

      // Adset data already in rc — no extra API call needed.
      const [campaign] = await db
        .insert(schema.campaigns)
        .values({
          orgId: org.id,
          platform: adAccount.platform,
          name: rc.name,
          objective: rc.objective,
          status: rc.status,
          currency: acctCurrency,
          budgetMinor:
            rc.primaryAdSetBudgetMinor ?? rc.campaignDailyBudgetMinor ?? null,
          adAccountId: adAccount.id,
          externalIds: rc.primaryAdSetId
            ? { [adAccount.platform]: rc.externalId, metaAdSet: rc.primaryAdSetId }
            : { [adAccount.platform]: rc.externalId },
        })
        .returning();

      // Insights already fetched in the batch — no extra API call needed.
      const daily = insightsBatch.get(rc.externalId) ?? [];
      for (const d of daily) {
        await upsertDailySnapshot(org.id, campaign.id, d);
      }
      imported++;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const message =
      /code 17|request limit|too many calls/i.test(raw)
        ? "Meta rate limit reached — wait a few minutes and try importing again."
        : `Import failed: ${raw}`;
    redirect(
      "/dashboard/campaigns?error=" + encodeURIComponent(message),
    );
  }

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns?imported=${imported}`);
}
