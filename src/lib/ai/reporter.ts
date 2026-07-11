import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "./models";

/** AI-written weekly performance report, stored in reports.payload. */
export const reportSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentence plain-language overview of the week"),
  highlights: z
    .array(z.string())
    .describe("What went well — concrete, metric-backed wins"),
  concerns: z
    .array(z.string())
    .describe("What needs attention — underperformance, fatigue, waste"),
  recommendations: z
    .array(z.string())
    .describe("What to do next week, most important first"),
});

export type ReportPayload = z.infer<typeof reportSchema> & {
  totals: {
    spendMinor: number;
    impressions: number;
    clicks: number;
    conversions: number;
    currency: string;
  };
  campaigns: CampaignWeek[];
  actions: string[];
};

export interface CampaignWeek {
  name: string;
  status: string;
  currency: string;
  spendMinor: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface ReportInput {
  periodStart: string;
  periodEnd: string;
  campaigns: CampaignWeek[];
  /** Audit-log actions taken during the period (by AI or human). */
  actions: string[];
}

const SYSTEM_PROMPT =
  "You are the reporting voice of an AI marketing manager. Write a concise weekly " +
  "report for the business owner: what happened, what worked, what needs attention, " +
  "and what to do next. Ground every statement in the numbers given — no filler, " +
  "no invented metrics. Money values are in minor units (divide by 100). Keep each " +
  "list item to one sentence.";

export async function generateWeeklyReport(
  input: ReportInput,
): Promise<z.infer<typeof reportSchema>> {
  const rows = input.campaigns.map(
    (c) =>
      `- ${c.name} [${c.status}]: spend ${(c.spendMinor / 100).toFixed(2)} ${c.currency}, ` +
      `${c.impressions} impressions, ${c.clicks} clicks` +
      `${c.impressions > 0 ? ` (CTR ${((c.clicks / c.impressions) * 100).toFixed(2)}%)` : ""}, ` +
      `${c.conversions} conversions`,
  );

  const { object } = await generateObject({
    model: strategistModel,
    schema: reportSchema,
    system: SYSTEM_PROMPT,
    prompt: [
      `Reporting period: ${input.periodStart} → ${input.periodEnd}`,
      `Campaign performance this period:`,
      ...(rows.length ? rows : ["(no campaign delivery this period)"]),
      input.actions.length
        ? `Actions taken this period (AI manager + human):\n${input.actions.map((a) => `- ${a}`).join("\n")}`
        : "No management actions were taken this period.",
      ``,
      `Write the weekly report.`,
    ].join("\n"),
  });
  return object;
}
