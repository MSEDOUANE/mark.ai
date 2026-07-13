import { generateObject } from "ai";
import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { strategistModel } from "./models";

/**
 * Cross-campaign budget allocation — the "media buyer" capability. Looks at
 * every active campaign's recent performance and proposes redistributing the
 * SAME total daily budget toward what's working. The proposal is stored as an
 * org-level approval (entityType "budget_allocation") surfaced on the
 * Overview; execution lives in manager/execute.ts.
 */

export const allocationSchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentence rationale for the overall reallocation"),
  lines: z
    .array(
      z.object({
        campaignId: z.string(),
        campaignName: z.string(),
        currentDailyBudgetMinor: z.number().int(),
        proposedDailyBudgetMinor: z
          .number()
          .int()
          .describe("≥100 (1.00 in currency); keep the org total within ±5%"),
        rationale: z.string().describe("One sentence tied to this campaign's numbers"),
      }),
    )
    .min(2),
  confidence: z.enum(["low", "medium", "high"]),
});

export type AllocationProposal = z.infer<typeof allocationSchema>;

interface CampaignPerf {
  id: string;
  name: string;
  currency: string;
  budgetMinor: number;
  spendMinor: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/**
 * Build and store an allocation proposal for the org. Returns the proposal, or
 * null when there's nothing to allocate (fewer than 2 active campaigns with
 * budgets and recent metrics, or a pending allocation already awaits a human).
 */
export async function proposeBudgetAllocation(
  orgId: string,
  requestedBy: string | null,
): Promise<AllocationProposal | null> {
  // One pending allocation at a time.
  const [pending] = await db
    .select({ id: schema.approvals.id })
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.orgId, orgId),
        eq(schema.approvals.entityType, "budget_allocation"),
        eq(schema.approvals.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return null;

  const campaigns = await db
    .select()
    .from(schema.campaigns)
    .where(
      and(eq(schema.campaigns.orgId, orgId), eq(schema.campaigns.status, "active")),
    );

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const perfs: CampaignPerf[] = [];
  for (const c of campaigns) {
    if (!c.budgetMinor || c.budgetMinor <= 0) continue;
    const rows = await db
      .select()
      .from(schema.metricsSnapshots)
      .where(
        and(
          eq(schema.metricsSnapshots.campaignId, c.id),
          gte(schema.metricsSnapshots.date, since),
        ),
      )
      .orderBy(desc(schema.metricsSnapshots.date))
      .limit(14);
    if (rows.length === 0) continue;
    perfs.push({
      id: c.id,
      name: c.name,
      currency: c.currency,
      budgetMinor: c.budgetMinor,
      spendMinor: rows.reduce((s, r) => s + r.spendMinor, 0),
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      conversions: rows.reduce((s, r) => s + r.conversions, 0),
    });
  }
  if (perfs.length < 2) return null;

  const totalMinor = perfs.reduce((s, p) => s + p.budgetMinor, 0);
  const rows = perfs.map((p) => {
    const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(2) : "0";
    const cpa =
      p.conversions > 0 ? (p.spendMinor / 100 / p.conversions).toFixed(2) : "n/a";
    return (
      `- id=${p.id} "${p.name}": budget ${(p.budgetMinor / 100).toFixed(2)}/day, ` +
      `14d spend ${(p.spendMinor / 100).toFixed(2)}, ${p.impressions} impr, ` +
      `${p.clicks} clicks (CTR ${ctr}%), ${p.conversions} conv (CPA ${cpa})`
    );
  });

  const { object } = await generateObject({
    model: strategistModel,
    schema: allocationSchema,
    system:
      "You are a performance-marketing media buyer reallocating a fixed daily budget " +
      "across campaigns. Move budget toward campaigns with better cost-per-conversion " +
      "(or CTR when conversions are sparse) and away from underperformers. Constraints: " +
      "every campaign keeps at least 100 minor units (1.00); the sum of proposed budgets " +
      "must stay within ±5% of the current total; include EVERY campaign listed, even " +
      "unchanged ones. Be conservative: shift at most ~30% of any campaign's budget in " +
      "one step. All money values are minor units.",
    prompt: [
      `Currency: ${perfs[0].currency} (minor units)`,
      `Current total daily budget: ${totalMinor}`,
      `Campaigns (last 14 days):`,
      ...rows,
      ``,
      `Propose the reallocation.`,
    ].join("\n"),
  });

  // Guardrails on the AI's math — clamp floors and reject runaway totals.
  const lines = object.lines
    .filter((l) => perfs.some((p) => p.id === l.campaignId))
    .map((l) => ({
      ...l,
      proposedDailyBudgetMinor: Math.max(100, Math.round(l.proposedDailyBudgetMinor)),
    }));
  const proposedTotal = lines.reduce((s, l) => s + l.proposedDailyBudgetMinor, 0);
  if (lines.length < 2 || proposedTotal > totalMinor * 1.1) return null;

  const proposal: AllocationProposal = { ...object, lines };

  await db.insert(schema.approvals).values({
    orgId,
    entityType: "budget_allocation",
    entityId: orgId, // org-level approval — not tied to one campaign
    status: "pending",
    requestedBy,
    payload: { proposal, currency: perfs[0].currency, totalMinor, proposedTotal },
  });

  return proposal;
}
