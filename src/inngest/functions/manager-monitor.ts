import { and, desc, eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { proposeOptimization } from "@/lib/ai/optimizer";
import { executeOptimization } from "@/lib/manager/execute";
import {
  optimizationRequiresApproval,
  type Autonomy,
} from "@/lib/manager/policy";

/**
 * AI Manager: analyze one active campaign's recent metrics, get an AI
 * recommendation, then either auto-apply it (spend-neutral/reducing actions) or
 * surface it as a pending approval (spend-increasing) — per the org's autonomy.
 * Triggered after each metrics sync.
 */
export const managerMonitorCampaign = inngest.createFunction(
  {
    id: "manager-monitor-campaign",
    name: "AI Manager: monitor campaign",
    retries: 1,
    triggers: [{ event: "manager/monitor.requested" }],
  },
  async ({ event, step }) => {
    const campaignId = event.data.campaignId as string;

    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign || campaign.status !== "active") {
      return { skipped: "not active" };
    }

    // Don't pile up recommendations: skip if one is already awaiting approval.
    const [pending] = await db
      .select()
      .from(schema.approvals)
      .where(
        and(
          eq(schema.approvals.entityId, campaignId),
          eq(schema.approvals.entityType, "optimization"),
          eq(schema.approvals.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) return { skipped: "approval pending" };

    const metrics = await db
      .select()
      .from(schema.metricsSnapshots)
      .where(eq(schema.metricsSnapshots.campaignId, campaignId))
      .orderBy(desc(schema.metricsSnapshots.date))
      .limit(14);
    if (metrics.length === 0) return { skipped: "no metrics" };

    const proposal = await step.run("propose", () =>
      proposeOptimization({
        campaignName: campaign.name,
        objective: campaign.objective ?? "traffic",
        currency: campaign.currency,
        currentDailyBudgetMinor: campaign.budgetMinor,
        metrics: metrics
          .map((m) => ({
            date: m.date,
            impressions: m.impressions,
            reach: m.reach,
            clicks: m.clicks,
            linkClicks: m.linkClicks,
            spendMinor: m.spendMinor,
            conversions: m.conversions,
            conversionValueMinor: m.conversionValueMinor,
          }))
          .reverse(),
      }),
    );

    if (proposal.action === "keep") return { action: "keep" };

    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, campaign.orgId))
      .limit(1);
    const autonomy = (org?.autonomyLevel ?? "approve_spend") as Autonomy;

    if (optimizationRequiresApproval(proposal.action, autonomy)) {
      await db.insert(schema.approvals).values({
        orgId: campaign.orgId,
        entityType: "optimization",
        entityId: campaignId,
        status: "pending",
        requestedBy: null,
        payload: { proposal, source: "manager" },
      });
      return { action: proposal.action, gated: true };
    }

    await executeOptimization(campaign, proposal, "ai");
    return { action: proposal.action, applied: true };
  },
);
