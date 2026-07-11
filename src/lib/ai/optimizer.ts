import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "./models";
import {
  optimizationSchema,
  type OptimizationProposal,
} from "./optimization-schema";

export interface MetricsRow {
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  spendMinor: number;
  conversions: number;
  conversionValueMinor: number;
}

export interface OptimizationContext {
  campaignName: string;
  objective: string;
  currency: string;
  currentDailyBudgetMinor: number | null;
  metrics: MetricsRow[];
  /** Original user brief (budget string, audience, goal) for budget-reasoning questions. */
  brief?: { budget?: string | null; audience?: string | null; goal?: string | null } | null;
  /** The strategist's explanation of why this budget fits the campaign. */
  strategyRationale?: string | null;
}

const SYSTEM_PROMPT =
  "You are a performance-marketing optimizer. Given a campaign's recent daily " +
  "metrics, recommend ONE action (keep / scale_up / scale_down / pause / kill / " +
  "refresh_creatives) with a short rationale. Be conservative with spend: only " +
  "scale_up when CTR and conversions clearly justify it; pause or kill clear " +
  "underperformers. Recommend refresh_creatives on creative fatigue — CTR " +
  "declining over several days while delivery holds steady (impressions/reach " +
  "stable but engagement dropping) — it generates fresh ad variants without " +
  "changing spend, so prefer it over scale_down when the budget itself looks " +
  "healthy. All budgets are in minor currency units. For scale_up/scale_down, " +
  "set suggestedDailyBudgetMinor.";

const optimizationAssistantSchema = z.object({
  answer: z
    .string()
    .describe(
      "A concise, direct answer to the user's question grounded in the campaign metrics.",
    ),
  proposal: optimizationSchema,
});

export interface OptimizationAssistantResponse {
  answer: string;
  proposal: OptimizationProposal;
}

/** Ask Claude to recommend an optimization action from recent metrics. */
export async function proposeOptimization(
  ctx: OptimizationContext,
): Promise<OptimizationProposal> {
  const { object } = await generateObject({
    model: strategistModel,
    schema: optimizationSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(ctx),
  });
  return object;
}

/** Ask the optimizer a conversational question and receive answer + proposal. */
export async function queryOptimizationAssistant(
  ctx: OptimizationContext,
  userQuery: string,
): Promise<OptimizationAssistantResponse> {
  const { object } = await generateObject({
    model: strategistModel,
    schema: optimizationAssistantSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(ctx, userQuery),
  });
  return object;
}

function buildPrompt(ctx: OptimizationContext, userQuery?: string): string {
  const budget =
    ctx.currentDailyBudgetMinor != null
      ? `${(ctx.currentDailyBudgetMinor / 100).toFixed(2)} ${ctx.currency}`
      : "unknown";
  const rows = ctx.metrics.map((m) => {
    const ctr =
      m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) : "0";
    const roas =
      m.spendMinor > 0 ? (m.conversionValueMinor / m.spendMinor).toFixed(2) : "0";
    return `${m.date}: reach ${m.reach}, ${m.impressions} impressions, ${m.clicks} clicks (${m.linkClicks} link), CTR ${ctr}%, spend ${(
      m.spendMinor / 100
    ).toFixed(2)} ${ctx.currency}, ${m.conversions} conversions, ROAS ${roas}`;
  });
  return [
    `Campaign: ${ctx.campaignName}`,
    `Objective: ${ctx.objective}`,
    `Current daily budget: ${budget}`,
    ctx.brief?.audience ? `Target audience: ${ctx.brief.audience}` : null,
    ctx.brief?.budget ? `Budget as entered by user: ${ctx.brief.budget}` : null,
    ctx.strategyRationale
      ? `Budget rationale from strategy: ${ctx.strategyRationale}`
      : null,
    userQuery
      ? `User question: ${userQuery}`
      : `User question: What should I do next with this campaign?`,
    `Recent daily metrics:`,
    ...rows,
    ``,
    `Answer the user's question, then recommend one action and a short rationale.`,
  ]
    .filter(Boolean)
    .join("\n");
}
