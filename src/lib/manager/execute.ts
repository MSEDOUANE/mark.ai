import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret } from "@/lib/crypto";
import {
  getCampaignProvider,
  type CampaignSpec,
  type FullLaunchPlan,
} from "@/lib/ads";
import { generateStrategy, type BriefInput } from "@/lib/ai/strategist";
import type { MarketResearch } from "@/lib/ai/research-schema";
import { renderCreativeImageBytes, type CreativeBrand } from "@/lib/creative/design";
import { createCreativesForCampaign } from "@/lib/creative/campaign-creatives";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";

type Campaign = typeof schema.campaigns.$inferSelect;
type AdAccount = typeof schema.adAccounts.$inferSelect;
type Creative = typeof schema.creatives.$inferSelect;
type Actor = "user" | "ai";

type CreativeMeta = {
  concept?: string;
  template?: "overlay" | "split" | "bold";
  headline?: string;
  primaryText?: string;
  callToAction?: string;
  score?: number;
};

/** Normalize geo input (array or "US, MA") into clean ISO-2 country codes. */
function normalizeCountries(
  v: string[] | string | null | undefined,
): string[] | null {
  if (!v) return null;
  const arr = Array.isArray(v) ? v : String(v).split(",");
  const codes = arr
    .map((s) => String(s).trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
  return codes.length ? codes : null;
}

/**
 * Pick the creatives to ship: highest-scoring first, preferring ready images.
 * Up to `max` variants launch as ads in the one ad set — two or more makes it
 * an A/B test that the winner-detection loop resolves once data comes in.
 */
function pickTopCreatives(rows: Creative[], max = 3): Creative[] {
  if (rows.length === 0) return [];
  const score = (r: Creative) => Number((r.meta as CreativeMeta)?.score ?? -1);
  const ready = rows.filter((r) => r.status === "ready");
  const pool = ready.length ? ready : rows;
  return [...pool].sort((a, b) => score(b) - score(a)).slice(0, max);
}

/**
 * Launch the *full, deliverable* campaign tree on the ad platform — campaign →
 * ad set (budget/targeting) → uploaded designed image → ad creative → ad — all
 * PAUSED, then record the result. Used by both the human approval action and the
 * AI Manager (full autopilot): the same spend-affecting path regardless of who
 * triggered it. The campaign approved as `spec` supplies name/objective/budget;
 * creative, brand, page, link and geo are resolved from the campaign + product.
 */
export async function executeLaunch(
  campaign: Campaign,
  spec: CampaignSpec,
  adAccount: AdAccount,
  actor: Actor,
) {
  if (!adAccount.encryptedToken) throw new Error("Ad account is not connected");
  const provider = getCampaignProvider(adAccount.platform);
  const token = decryptSecret(adAccount.encryptedToken);
  const brief = (campaign.brief ?? {}) as BriefInput;

  // Destination: WhatsApp chat (click-to-WhatsApp) or a website landing page.
  const destination = brief.destination === "whatsapp" ? "whatsapp" : "website";
  const link =
    destination === "whatsapp"
      ? "https://api.whatsapp.com/send"
      : (brief.websiteUrl ?? "").trim();
  if (!link) {
    throw new Error(
      "Set a destination website URL on the campaign before launching — Meta ads need a landing page to click through to.",
    );
  }
  const countries = normalizeCountries(brief.geoCountries) ?? ["US"];

  // Brand kit (for the designed creative image) from the product.
  let brand: CreativeBrand = {};
  if (campaign.productId) {
    const [product] = await db
      .select({ brand: schema.products.brand })
      .from(schema.products)
      .where(eq(schema.products.id, campaign.productId))
      .limit(1);
    brand = (product?.brand ?? {}) as CreativeBrand;
  }

  // The creatives to ship (up to 3 → A/B test between variants).
  const creativeRows = await db
    .select()
    .from(schema.creatives)
    .where(eq(schema.creatives.campaignId, campaign.id));
  const chosenCreatives = pickTopCreatives(creativeRows);
  if (chosenCreatives.length === 0) {
    throw new Error(
      "No creative to launch — wait for creative generation to finish, then launch.",
    );
  }

  // Resolve the Facebook Page (required for any ad creative). Reuse a stored
  // page when present; otherwise discover one and remember it.
  const acctMeta = (adAccount.meta ?? {}) as Record<string, unknown>;
  let pageId = acctMeta.pageId ? String(acctMeta.pageId) : "";
  if (!pageId) {
    const pages = await provider.listPages(token);
    if (pages.length === 0) {
      throw new Error(
        "No Facebook Page is available on this Meta connection. Reconnect Meta granting Page access (pages_show_list / pages_manage_ads), then launch.",
      );
    }
    pageId = pages[0].id;
    await db
      .update(schema.adAccounts)
      .set({ meta: { ...acctMeta, pageId, pageName: pages[0].name } })
      .where(eq(schema.adAccounts.id, adAccount.id));
  }

  // Render each variant's designed creative to PNG bytes for upload.
  const variants = await Promise.all(
    chosenCreatives.map(async (c) => {
      const m = (c.meta ?? {}) as CreativeMeta;
      const imageBytes = await renderCreativeImageBytes(
        {
          headline: m.headline,
          primaryText: m.primaryText,
          callToAction: m.callToAction,
          concept: m.concept,
          template: m.template,
          brand,
          bgImageUrl: c.status === "ready" ? c.assetUrl : null,
        },
        "square",
      );
      return {
        headline: m.headline ?? spec.name,
        primaryText: m.primaryText ?? "",
        callToAction: m.callToAction ?? "Learn More",
        link,
        imageBytes,
        imageName: `creative-${c.id}.png`,
        refId: c.id,
      };
    }),
  );

  const plan: FullLaunchPlan = {
    campaignName: spec.name,
    objective: spec.objective,
    dailyBudgetMinor: spec.dailyBudgetMinor,
    countries,
    pageId,
    destination,
    creatives: variants,
  };

  const result = await provider.launchFull(plan, {
    externalId: adAccount.externalId,
    accessToken: token,
  });

  await db
    .update(schema.campaigns)
    .set({
      status: "active",
      externalIds: {
        [adAccount.platform]: result.externalCampaignId,
        metaAdSet: result.externalAdSetId,
        metaAd: result.externalAdId,
        metaCreative: result.externalCreativeId,
        // All shipped variant ad ids — the A/B winner check keys off this.
        metaAds: result.ads.map((a) => a.adId),
      },
      adAccountId: adAccount.id,
      budgetMinor: spec.dailyBudgetMinor,
      updatedAt: new Date(),
    })
    .where(eq(schema.campaigns.id, campaign.id));

  // Mark each launched creative with its platform ids.
  for (const ad of result.ads) {
    if (!ad.refId) continue;
    const row = chosenCreatives.find((c) => c.id === ad.refId);
    if (!row) continue;
    await db
      .update(schema.creatives)
      .set({
        meta: {
          ...((row.meta ?? {}) as CreativeMeta),
          launchedAdId: ad.adId,
          launchedCreativeId: ad.creativeId,
        },
      })
      .where(eq(schema.creatives.id, ad.refId));
  }

  await db.insert(schema.auditLog).values({
    orgId: campaign.orgId,
    campaignId: campaign.id,
    actor,
    action: "campaign_launch",
    payload: {
      spec,
      platform: adAccount.platform,
      creativeIds: chosenCreatives.map((c) => c.id),
      abTest: result.ads.length > 1,
      pageId,
      countries,
      link,
      ...result,
    },
    costMinor: spec.dailyBudgetMinor,
  });

  return result;
}

/**
 * Apply an optimization action (pause / kill / scale) and record it. Used by
 * both the human approval action and the AI Manager auto-apply path.
 */
export async function executeOptimization(
  campaign: Campaign,
  proposal: OptimizationProposal,
  actor: Actor,
) {
  if (proposal.action === "pause" || proposal.action === "kill") {
    const externalIds = (campaign.externalIds ?? {}) as Record<string, string>;
    const externalId = externalIds[campaign.platform];
    if (campaign.adAccountId && externalId) {
      const [adAccount] = await db
        .select()
        .from(schema.adAccounts)
        .where(eq(schema.adAccounts.id, campaign.adAccountId))
        .limit(1);
      if (adAccount?.encryptedToken) {
        const provider = getCampaignProvider(campaign.platform);
        await provider.pause(externalId, decryptSecret(adAccount.encryptedToken));
      }
    }
    await db
      .update(schema.campaigns)
      .set({
        status: proposal.action === "kill" ? "completed" : "paused",
        updatedAt: new Date(),
      })
      .where(eq(schema.campaigns.id, campaign.id));
  } else if (proposal.action === "declare_winner") {
    // A/B test resolved: pause the losing variant ads on the platform. The
    // ad-set budget is untouched — delivery consolidates onto the winner, so
    // this is spend-neutral. (provider.pause posts PAUSED to any object id.)
    const loserIds = proposal.loserAdIds ?? [];
    if (campaign.adAccountId && loserIds.length) {
      const [adAccount] = await db
        .select()
        .from(schema.adAccounts)
        .where(eq(schema.adAccounts.id, campaign.adAccountId))
        .limit(1);
      if (adAccount?.encryptedToken) {
        const provider = getCampaignProvider(campaign.platform);
        const token = decryptSecret(adAccount.encryptedToken);
        for (const adId of loserIds) {
          await provider.pause(adId, token);
        }
      }
    }
  } else if (proposal.action === "refresh_creatives") {
    // Creative fatigue: generate fresh ad variants (spend-neutral — no budget
    // or delivery change). New concepts come from the strategist, grounded in
    // the campaign's own brief + research, told to move away from the current
    // angles.
    const brief = (campaign.brief ?? {}) as BriefInput;
    const research = (campaign.research ?? null) as MarketResearch | null;

    const currentCreatives = await db
      .select({ meta: schema.creatives.meta })
      .from(schema.creatives)
      .where(eq(schema.creatives.campaignId, campaign.id));
    const currentAngles = currentCreatives
      .map((c) => (c.meta as CreativeMeta)?.headline)
      .filter(Boolean)
      .slice(0, 8);

    const strategy = await generateStrategy(
      {
        ...brief,
        productName: brief.productName ?? campaign.name,
        goal:
          `${brief.goal ?? campaign.objective ?? "performance"} — the current ads show ` +
          `creative fatigue (${proposal.rationale}). Produce FRESH creative concepts ` +
          `with clearly different hooks and visual scenes than these existing headlines: ` +
          `${currentAngles.join(" | ") || "(none)"}.`,
      },
      research,
    );

    await createCreativesForCampaign(campaign, strategy.creatives, {
      refreshedBy: actor,
      refreshRationale: proposal.rationale,
    });
  } else if (
    (proposal.action === "scale_up" || proposal.action === "scale_down") &&
    proposal.suggestedDailyBudgetMinor
  ) {
    // Apply the new budget to the platform ad set when we know it (imported
    // campaigns store metaAdSet), then record it locally.
    const externalIds = (campaign.externalIds ?? {}) as Record<string, string>;
    const adSetId = externalIds.metaAdSet;
    if (campaign.adAccountId && adSetId) {
      const [adAccount] = await db
        .select()
        .from(schema.adAccounts)
        .where(eq(schema.adAccounts.id, campaign.adAccountId))
        .limit(1);
      if (adAccount?.encryptedToken) {
        const provider = getCampaignProvider(campaign.platform);
        await provider.updateAdSetBudget(
          adSetId,
          proposal.suggestedDailyBudgetMinor,
          decryptSecret(adAccount.encryptedToken),
        );
      }
    }
    await db
      .update(schema.campaigns)
      .set({
        budgetMinor: proposal.suggestedDailyBudgetMinor,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaigns.id, campaign.id));
  }

  await db.insert(schema.auditLog).values({
    orgId: campaign.orgId,
    campaignId: campaign.id,
    actor,
    action: `optimization_${proposal.action}`,
    payload: { proposal },
  });
}
