import { and, eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { generateStrategy, type BriefInput } from "@/lib/ai/strategist";
import { researchMarket } from "@/lib/ai/researcher";
import {
  buildCampaignSpec,
  launchRequiresApproval,
  type Autonomy,
} from "@/lib/manager/policy";
import { executeLaunch } from "@/lib/manager/execute";
import { createCreativesForCampaign } from "@/lib/creative/campaign-creatives";

/**
 * The agent's planning job: research → strategy → creatives → launch gate,
 * run in the background so campaign creation returns instantly. The campaign is
 * created first (status "draft", no strategy yet); this fills it in.
 */
export const generateCampaignPlan = inngest.createFunction(
  {
    id: "generate-campaign-plan",
    name: "Generate campaign plan",
    retries: 1,
    triggers: [{ event: "campaign/generate.requested" }],
  },
  async ({ event, step }) => {
    const campaignId = event.data.campaignId as string;
    const userId = (event.data.userId as string | undefined) ?? null;

    const [campaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return { skipped: "campaign not found" };
    const brief = campaign.brief as BriefInput;

    try {
      // 1. Research (web-search grounded). Memoized as a step so a retry won't
      //    re-pay for the search.
      const research = await step.run("research", async () => {
        try {
          return await researchMarket({
            productName: brief.productName,
            productDescription: brief.productDescription,
            goal: brief.goal,
            audienceHint: brief.audience,
          });
        } catch (e) {
          console.error("[generate-campaign] research failed:", e);
          return null;
        }
      });
      await db
        .update(schema.campaigns)
        .set({ research, updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaignId));

      // 2. Strategy, grounded in the research.
      const strategy = await step.run("strategy", () =>
        generateStrategy(brief, research),
      );
      const platform = strategy.channels[0]?.platform ?? "meta";
      await db
        .update(schema.campaigns)
        .set({ strategy, platform, updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaignId));

      // 3. Creatives — one row per concept + async generation. Idempotent:
      //    skip if this campaign already has creatives (e.g. on retry).
      const existingCreatives = await db
        .select({ id: schema.creatives.id })
        .from(schema.creatives)
        .where(eq(schema.creatives.campaignId, campaignId))
        .limit(1);
      if (existingCreatives.length === 0) {
        await createCreativesForCampaign(campaign, strategy.creatives);
      }

      // 4. AI Manager kickoff: advance to the launch gate (or auto-launch under
      //    full autopilot) when an ad account for the platform is connected.
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, campaign.orgId))
        .limit(1);
      const [adAccount] = await db
        .select()
        .from(schema.adAccounts)
        .where(
          and(
            eq(schema.adAccounts.orgId, campaign.orgId),
            eq(schema.adAccounts.platform, platform),
          ),
        )
        .limit(1);

      if (org && adAccount) {
        const existingLaunch = await db
          .select({ id: schema.approvals.id })
          .from(schema.approvals)
          .where(
            and(
              eq(schema.approvals.entityId, campaignId),
              eq(schema.approvals.entityType, "campaign_launch"),
              eq(schema.approvals.status, "pending"),
            ),
          )
          .limit(1);
        const alreadyKicked =
          campaign.status === "pending_approval" ||
          campaign.status === "active" ||
          existingLaunch.length > 0;

        if (!alreadyKicked) {
          const autonomy = org.autonomyLevel as Autonomy;
          // Money flows in the ad account's real currency (Meta reports in it) —
          // inherit it instead of keeping the schema default (MAD).
          const acctCurrency =
            ((adAccount.meta ?? {}) as { currency?: string }).currency ??
            campaign.currency;
          const spec = buildCampaignSpec({
            name: campaign.name,
            objective: campaign.objective,
            currency: acctCurrency,
            budget: brief.budget,
          });
          if (launchRequiresApproval(autonomy)) {
            await db.insert(schema.approvals).values({
              orgId: campaign.orgId,
              entityType: "campaign_launch",
              entityId: campaignId,
              status: "pending",
              requestedBy: userId,
              payload: { spec, adAccountId: adAccount.id },
            });
            await db
              .update(schema.campaigns)
              .set({
                status: "pending_approval",
                adAccountId: adAccount.id,
                currency: acctCurrency,
              })
              .where(eq(schema.campaigns.id, campaignId));
          } else {
            await db
              .update(schema.campaigns)
              .set({ currency: acctCurrency })
              .where(eq(schema.campaigns.id, campaignId));
            await executeLaunch(
              { ...campaign, currency: acctCurrency },
              spec,
              adAccount,
              "ai",
            );
          }
        }
      }

      return { campaignId, ok: true };
    } catch (err) {
      await db
        .update(schema.campaigns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaignId));
      await db.insert(schema.auditLog).values({
        orgId: campaign.orgId,
        campaignId,
        actor: "ai",
        action: "campaign_generation_failed",
        payload: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  },
);
