import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import { strategistModel } from "./models";
import { proposeOptimization } from "./optimizer";
import { executeOptimization } from "@/lib/manager/execute";
import type { BriefInput } from "./strategist";

/**
 * The global marketing assistant: one conversation that can invoke ANY of the
 * agent's capabilities as tools — read performance, create campaigns, refresh
 * creatives, request optimizations, run reports. Spend safety is inherited:
 * campaign creation lands in the normal launch-approval pipeline, and
 * optimization proposals go through the same gating policy as everywhere else.
 */

const SYSTEM_PROMPT =
  "You are MarkAI, the user's AI marketing manager. You have tools that read " +
  "real campaign data and take real actions — always use them rather than " +
  "guessing; never invent metrics. Money values from tools are in minor units " +
  "(divide by 100 for display). Be concise and concrete: lead with the answer " +
  "or the action taken, then 1-3 supporting facts. When you take an action, " +
  "say exactly what happened and what (if anything) awaits the user's approval " +
  "— launches and spend increases always require human approval on the " +
  "campaign page. When asked for something you have no tool for, say so " +
  "plainly and suggest the closest thing you can do.";

export interface AssistantReply {
  text: string;
  toolsUsed: string[];
}

function buildTools(orgId: string, userId: string | null) {
  return {
    get_overview: tool({
      description:
        "Snapshot of the whole account: campaign/creative/brand counts, open anomaly alerts, and pending approvals awaiting the human.",
      inputSchema: z.object({}),
      execute: async () => {
        const [campaigns, alerts, approvals] = await Promise.all([
          db
            .select({
              id: schema.campaigns.id,
              name: schema.campaigns.name,
              status: schema.campaigns.status,
              budgetMinor: schema.campaigns.budgetMinor,
              currency: schema.campaigns.currency,
            })
            .from(schema.campaigns)
            .where(eq(schema.campaigns.orgId, orgId))
            .orderBy(desc(schema.campaigns.createdAt))
            .limit(15),
          db
            .select({
              type: schema.alerts.type,
              severity: schema.alerts.severity,
              message: schema.alerts.message,
              campaignId: schema.alerts.campaignId,
            })
            .from(schema.alerts)
            .where(
              and(eq(schema.alerts.orgId, orgId), eq(schema.alerts.status, "open")),
            )
            .limit(10),
          db
            .select({
              entityType: schema.approvals.entityType,
              entityId: schema.approvals.entityId,
              payload: schema.approvals.payload,
            })
            .from(schema.approvals)
            .where(
              and(
                eq(schema.approvals.orgId, orgId),
                eq(schema.approvals.status, "pending"),
              ),
            )
            .limit(10),
        ]);
        return { campaigns, openAlerts: alerts, pendingApprovals: approvals };
      },
    }),

    get_campaign_performance: tool({
      description:
        "Daily metrics for one campaign over the last N days: impressions, clicks, spend (minor units), conversions.",
      inputSchema: z.object({
        campaignId: z.string().describe("Campaign id from get_overview"),
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ campaignId, days }) => {
        const [campaign] = await db
          .select()
          .from(schema.campaigns)
          .where(
            and(
              eq(schema.campaigns.id, campaignId),
              eq(schema.campaigns.orgId, orgId),
            ),
          )
          .limit(1);
        if (!campaign) return { error: "Campaign not found" };
        const since = new Date(Date.now() - days * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const rows = await db
          .select({
            date: schema.metricsSnapshots.date,
            impressions: schema.metricsSnapshots.impressions,
            clicks: schema.metricsSnapshots.clicks,
            spendMinor: schema.metricsSnapshots.spendMinor,
            conversions: schema.metricsSnapshots.conversions,
          })
          .from(schema.metricsSnapshots)
          .where(
            and(
              eq(schema.metricsSnapshots.campaignId, campaignId),
              gte(schema.metricsSnapshots.date, since),
            ),
          )
          .orderBy(schema.metricsSnapshots.date);
        const totals = rows.reduce(
          (t, r) => ({
            impressions: t.impressions + r.impressions,
            clicks: t.clicks + r.clicks,
            spendMinor: t.spendMinor + r.spendMinor,
            conversions: t.conversions + r.conversions,
          }),
          { impressions: 0, clicks: 0, spendMinor: 0, conversions: 0 },
        );
        return {
          campaign: {
            name: campaign.name,
            status: campaign.status,
            currency: campaign.currency,
          },
          totals,
          days: rows,
        };
      },
    }),

    list_brands_and_products: tool({
      description:
        "The brand profiles (with voice/tone) and the reusable product catalog.",
      inputSchema: z.object({}),
      execute: async () => {
        const [brands, products] = await Promise.all([
          db
            .select({
              id: schema.brandProfiles.id,
              name: schema.brandProfiles.name,
              tone: schema.brandProfiles.tone,
              description: schema.brandProfiles.description,
            })
            .from(schema.brandProfiles)
            .where(eq(schema.brandProfiles.orgId, orgId)),
          db
            .select({
              id: schema.products.id,
              name: schema.products.name,
              description: schema.products.description,
              brandProfileId: schema.products.brandProfileId,
            })
            .from(schema.products)
            .where(
              and(
                eq(schema.products.orgId, orgId),
                isNotNull(schema.products.brandProfileId),
              ),
            ),
        ]);
        return { brands, products };
      },
    }),

    create_campaign: tool({
      description:
        "Create a new campaign from a brief. The agent pipeline then researches the market, writes the strategy in the brand's voice, generates creatives, and stops at the human launch-approval gate. Match brandId/productId from list_brands_and_products when the user names them.",
      inputSchema: z.object({
        productName: z.string(),
        goal: z.string().describe("Campaign goal, e.g. 'Drive online sales for the summer drop'"),
        brandId: z.string().optional(),
        productId: z.string().optional().describe("Reuse a catalog product"),
        productDescription: z.string().optional(),
        audience: z.string().optional(),
        budget: z.string().optional().describe("Free text, e.g. '30 USD / week'"),
        websiteUrl: z.string().optional().describe("Destination URL (needed to launch)"),
        geoCountries: z.string().optional().describe("e.g. 'MA, FR'"),
      }),
      execute: async (input) => {
        let brandName: string | null = null;
        let brandDescription: string | null = null;
        let tone: string | null = null;
        if (input.brandId) {
          const [bp] = await db
            .select()
            .from(schema.brandProfiles)
            .where(
              and(
                eq(schema.brandProfiles.id, input.brandId),
                eq(schema.brandProfiles.orgId, orgId),
              ),
            )
            .limit(1);
          if (bp) {
            brandName = bp.name;
            brandDescription = bp.description;
            tone = bp.tone;
          }
        }

        // Reuse the catalog product when given; otherwise create one (joined
        // to the brand so it enters the catalog).
        let product: typeof schema.products.$inferSelect | undefined;
        if (input.productId) {
          [product] = await db
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.id, input.productId),
                eq(schema.products.orgId, orgId),
              ),
            )
            .limit(1);
        }
        if (!product) {
          [product] = await db
            .insert(schema.products)
            .values({
              orgId,
              brandProfileId: input.brandId ?? null,
              name: input.productName,
              description: input.productDescription ?? null,
              targetAudience: input.audience ?? null,
              brand: {},
            })
            .returning();
        }

        const brief: BriefInput = {
          productName: input.productName,
          productDescription: input.productDescription ?? product.description,
          goal: input.goal,
          audience: input.audience,
          budget: input.budget,
          tone,
          brandName,
          brandDescription,
          websiteUrl: input.websiteUrl,
          geoCountries: input.geoCountries,
        };

        const [campaign] = await db
          .insert(schema.campaigns)
          .values({
            orgId,
            productId: product.id,
            platform: "meta",
            name: `${input.productName} — ${input.goal}`.slice(0, 120),
            objective: input.goal,
            status: "draft",
            brief,
          })
          .returning();

        try {
          await inngest.send({
            name: "campaign/generate.requested",
            data: { campaignId: campaign.id, userId },
          });
        } catch (err) {
          console.error("[assistant] enqueue failed:", err);
          return {
            campaignId: campaign.id,
            warning:
              "Campaign saved as draft but background generation could not start (job runner offline).",
          };
        }
        return {
          campaignId: campaign.id,
          url: `/dashboard/campaigns/${campaign.id}`,
          note: "Agent pipeline started: research → strategy → creatives → launch approval gate.",
        };
      },
    }),

    refresh_campaign_creatives: tool({
      description:
        "Generate fresh creative variants for an existing campaign (new hooks/scenes in the brand voice). Spend-neutral. Takes ~30s.",
      inputSchema: z.object({
        campaignId: z.string(),
        reason: z.string().describe("Why — shown in the audit trail"),
      }),
      execute: async ({ campaignId, reason }) => {
        const [campaign] = await db
          .select()
          .from(schema.campaigns)
          .where(
            and(
              eq(schema.campaigns.id, campaignId),
              eq(schema.campaigns.orgId, orgId),
            ),
          )
          .limit(1);
        if (!campaign) return { error: "Campaign not found" };
        await executeOptimization(
          campaign,
          { action: "refresh_creatives", rationale: reason, confidence: "high" },
          "user",
        );
        return { ok: true, note: "Fresh variants are generating — they appear on the campaign page shortly." };
      },
    }),

    request_optimization: tool({
      description:
        "Ask the AI optimizer to analyze a campaign's recent metrics and recommend an action. Spend-increasing recommendations become pending approvals; the human decides on the campaign page.",
      inputSchema: z.object({ campaignId: z.string() }),
      execute: async ({ campaignId }) => {
        const [campaign] = await db
          .select()
          .from(schema.campaigns)
          .where(
            and(
              eq(schema.campaigns.id, campaignId),
              eq(schema.campaigns.orgId, orgId),
            ),
          )
          .limit(1);
        if (!campaign) return { error: "Campaign not found" };
        const metrics = await db
          .select()
          .from(schema.metricsSnapshots)
          .where(eq(schema.metricsSnapshots.campaignId, campaignId))
          .orderBy(desc(schema.metricsSnapshots.date))
          .limit(30);
        if (metrics.length === 0) {
          return { error: "No metrics yet — sync or refresh metrics first." };
        }
        const proposal = await proposeOptimization({
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
        });
        if (proposal.action !== "keep") {
          await db.insert(schema.approvals).values({
            orgId,
            entityType: "optimization",
            entityId: campaignId,
            status: "pending",
            requestedBy: userId,
            payload: { proposal, source: "assistant" },
          });
        }
        return {
          proposal,
          gated: proposal.action !== "keep",
          note:
            proposal.action !== "keep"
              ? `Recommendation created as a pending approval — review it at /dashboard/campaigns/${campaignId}/chat.`
              : "No change recommended.",
        };
      },
    }),

    generate_weekly_report: tool({
      description:
        "Generate a fresh AI performance report for the last 7 days (appears on the Overview page shortly).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          await inngest.send({
            name: "report/generate.requested",
            data: { orgId },
          });
          return { ok: true, note: "Report generating — it lands on the Overview page in under a minute." };
        } catch {
          return { error: "Job runner offline — could not enqueue the report." };
        }
      },
    }),
  };
}

export async function runAssistant(
  orgId: string,
  userId: string | null,
  messages: ModelMessage[],
): Promise<AssistantReply> {
  const result = await generateText({
    model: strategistModel,
    system: SYSTEM_PROMPT,
    messages,
    tools: buildTools(orgId, userId),
    stopWhen: stepCountIs(6),
  });

  const toolsUsed = result.steps
    .flatMap((s) => s.toolCalls ?? [])
    .map((c) => c.toolName);

  return { text: result.text, toolsUsed: [...new Set(toolsUsed)] };
}
