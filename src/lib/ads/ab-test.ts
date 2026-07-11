import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCampaignProvider } from "@/lib/ads";
import { decryptSecret } from "@/lib/crypto";
import { executeOptimization } from "@/lib/manager/execute";
import type { Autonomy } from "@/lib/manager/policy";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import type { AdBreakdown } from "@/lib/ads/provider";

/** Minimum impressions PER VARIANT before a verdict is allowed. */
const MIN_IMPRESSIONS_PER_AD = 500;
/** Winner must beat the runner-up CTR by this relative factor. */
const CTR_LEAD_FACTOR = 1.3;
/** With enough conversions, conversion count outranks CTR. */
const MIN_CONVERSIONS_FOR_CONV_VERDICT = 3;

export interface AbVerdict {
  winner: AdBreakdown;
  losers: AdBreakdown[];
  rationale: string;
}

/** Pure decision rule over per-ad KPIs — exported for unit testing. */
export function pickAbWinner(ads: AdBreakdown[]): AbVerdict | null {
  const active = ads.filter((a) => a.status === "ACTIVE");
  if (active.length < 2) return null;
  if (active.some((a) => a.kpis.impressions < MIN_IMPRESSIONS_PER_AD)) return null;

  const ctr = (a: AdBreakdown) =>
    a.kpis.impressions > 0 ? a.kpis.clicks / a.kpis.impressions : 0;

  // Conversion-based verdict when there's real conversion signal.
  const totalConv = active.reduce((s, a) => s + a.kpis.conversions, 0);
  if (totalConv >= MIN_CONVERSIONS_FOR_CONV_VERDICT) {
    const byConv = [...active].sort(
      (a, b) => b.kpis.conversions - a.kpis.conversions,
    );
    const [first, second] = byConv;
    if (first.kpis.conversions >= second.kpis.conversions * 2 && first.kpis.conversions >= 2) {
      return {
        winner: first,
        losers: byConv.slice(1),
        rationale:
          `“${first.name}” converted ${first.kpis.conversions}× vs ${second.kpis.conversions}× for the runner-up ` +
          `over the test window — consolidating delivery on the winner.`,
      };
    }
    return null; // conversions present but no clear leader yet
  }

  // CTR-based verdict otherwise.
  const byCtr = [...active].sort((a, b) => ctr(b) - ctr(a));
  const [first, second] = byCtr;
  if (ctr(second) === 0 || ctr(first) >= ctr(second) * CTR_LEAD_FACTOR) {
    return {
      winner: first,
      losers: byCtr.slice(1),
      rationale:
        `“${first.name}” leads with ${(ctr(first) * 100).toFixed(2)}% CTR vs ` +
        `${(ctr(second) * 100).toFixed(2)}% for the runner-up (${first.kpis.impressions.toLocaleString("en-US")} impressions) ` +
        `— consolidating delivery on the winner.`,
    };
  }
  return null;
}

/**
 * A/B winner check for one campaign: when 2+ launched variant ads have enough
 * data and a clear leader, pause the losers. Spend-neutral (ad-set budget is
 * unchanged), so it auto-applies under approve_spend/full_auto; under
 * approve_all it becomes a pending optimization approval instead. Either way
 * an alert row surfaces it on the Overview.
 */
export async function checkAbTestWinner(campaignId: string): Promise<boolean> {
  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  if (!campaign || campaign.status !== "active" || !campaign.adAccountId) {
    return false;
  }

  const extIds = (campaign.externalIds ?? {}) as Record<string, unknown>;
  const metaAds = Array.isArray(extIds.metaAds)
    ? (extIds.metaAds as string[])
    : [];
  const externalCampaignId = extIds[campaign.platform] as string | undefined;
  if (metaAds.length < 2 || !externalCampaignId) return false;

  // Don't re-propose while a verdict (or any optimization) awaits approval —
  // under approve_all the losers stay ACTIVE until the human decides.
  const [pending] = await db
    .select({ id: schema.approvals.id })
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.entityId, campaignId),
        eq(schema.approvals.entityType, "optimization"),
        eq(schema.approvals.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return false;

  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(eq(schema.adAccounts.id, campaign.adAccountId))
    .limit(1);
  if (!adAccount?.encryptedToken) return false;

  const provider = getCampaignProvider(campaign.platform);
  const token = decryptSecret(adAccount.encryptedToken);
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  const breakdown = await provider.getCampaignBreakdown(
    { externalCampaignId, since, until },
    token,
  );
  const testAds = breakdown.ads.filter((a) => metaAds.includes(a.id));
  const verdict = pickAbWinner(testAds);
  if (!verdict) return false;

  const proposal: OptimizationProposal = {
    action: "declare_winner",
    rationale: verdict.rationale,
    winnerAdId: verdict.winner.id,
    loserAdIds: verdict.losers.map((l) => l.id),
    confidence: "high",
  };

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, campaign.orgId))
    .limit(1);
  const autonomy = (org?.autonomyLevel ?? "approve_spend") as Autonomy;

  if (autonomy === "approve_all") {
    await db.insert(schema.approvals).values({
      orgId: campaign.orgId,
      entityType: "optimization",
      entityId: campaignId,
      status: "pending",
      requestedBy: null,
      payload: { proposal, source: "ab-test" },
    });
  } else {
    await executeOptimization(campaign, proposal, "ai");
  }

  // Surface the verdict on the Overview either way.
  await db.insert(schema.alerts).values({
    orgId: campaign.orgId,
    campaignId,
    type: "ab_winner",
    severity: "warning",
    message:
      `A/B test resolved on “${campaign.name}”: ${verdict.rationale}` +
      (autonomy === "approve_all"
        ? " Awaiting your approval to pause the losing ads."
        : ` Paused ${verdict.losers.length} losing ad${verdict.losers.length !== 1 ? "s" : ""}.`),
    data: {
      winnerAdId: verdict.winner.id,
      loserAdIds: verdict.losers.map((l) => l.id),
    },
  });

  return true;
}
