import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { getCampaignProvider } from "@/lib/ads";
import { upsertDailySnapshot } from "@/lib/ads/metrics-store";
import { checkCampaignAnomalies } from "@/lib/ads/alerts-store";
import { checkAbTestWinner } from "@/lib/ads/ab-test";
import { decryptSecret } from "@/lib/crypto";

function yesterdayISO(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** Pull one campaign's insights for yesterday and upsert a metrics snapshot. */
export const syncCampaignMetrics = inngest.createFunction(
  {
    id: "sync-campaign-metrics",
    name: "Sync campaign metrics",
    retries: 2,
    triggers: [{ event: "metrics/sync.requested" }],
  },
  async ({ event, step }) => {
    const campaignId = event.data.campaignId as string;

    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign || !campaign.adAccountId) return { skipped: "no ad account" };

    const externalIds = (campaign.externalIds ?? {}) as Record<string, string>;
    const externalId = externalIds[campaign.platform];
    if (!externalId) return { skipped: "not launched" };

    const [adAccount] = await db
      .select()
      .from(schema.adAccounts)
      .where(eq(schema.adAccounts.id, campaign.adAccountId))
      .limit(1);
    if (!adAccount?.encryptedToken) return { skipped: "no token" };

    const provider = getCampaignProvider(campaign.platform);
    const token = decryptSecret(adAccount.encryptedToken);
    const date = yesterdayISO();

    const insights = await step.run("get-insights", () =>
      provider.getInsights(
        { externalCampaignId: externalId, since: date, until: date },
        token,
      ),
    );

    await upsertDailySnapshot(campaign.orgId, campaignId, {
      date,
      impressions: insights.impressions,
      reach: insights.reach,
      clicks: insights.clicks,
      linkClicks: insights.linkClicks,
      spendMinor: insights.spendMinor,
      conversions: insights.conversions,
      conversionValueMinor: insights.conversionValueMinor,
      raw: insights.raw,
    });

    // Immediate anomaly check — cheap rule-based scan of the fresh data.
    const alertsCreated = await step.run("check-anomalies", () =>
      checkCampaignAnomalies(campaignId),
    );

    // A/B test verdict: when variant ads have enough data and a clear leader,
    // pause the losers (autonomy-gated inside).
    const abResolved = await step.run("check-ab-winner", () =>
      checkAbTestWinner(campaignId),
    );

    // Hand off to the AI Manager to analyze the fresh metrics.
    await inngest.send({
      name: "manager/monitor.requested",
      data: { campaignId },
    });

    return { campaignId, date, alertsCreated, abResolved };
  },
);

/** Daily: enqueue a metrics sync for every active campaign. */
export const scheduledMetricsSync = inngest.createFunction(
  {
    id: "scheduled-metrics-sync",
    name: "Daily metrics sync",
    triggers: [{ cron: "0 6 * * *" }],
  },
  async () => {
    const active = await db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active"));

    await Promise.all(
      active.map((c) =>
        inngest.send({ name: "metrics/sync.requested", data: { campaignId: c.id } }),
      ),
    );
    return { enqueued: active.length };
  },
);
