import { z } from "zod";
import { generateObject } from "ai";
import { strategistModel } from "./models";

/** Predicted conversion potential of an ad creative + how to improve it. */
export const creativeScoreSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(100)
    .describe("Predicted conversion potential, 0-100."),
  rationale: z.string().describe("One concise sentence on the main driver."),
  tips: z
    .array(z.string())
    .max(3)
    .describe("0-3 concrete changes that would raise the score. Empty when already excellent."),
  predictedCtrBand: z
    .enum(["Below average", "Average", "Above average", "Excellent"])
    .describe("AI ESTIMATE (not measured data): where this creative's CTR would likely land vs. typical performance ads in this category."),
  conversionLikelihood: z
    .enum(["Low", "Medium", "High"])
    .describe("AI ESTIMATE (not measured data): likelihood this creative drives conversions once clicked, based on message-to-offer alignment."),
});
export type CreativeScore = z.infer<typeof creativeScoreSchema>;

export interface CreativeScoreInput {
  productName?: string | null;
  concept?: string | null;
  headline?: string | null;
  primaryText?: string | null;
  callToAction?: string | null;
  type?: string | null;
}

const SYSTEM =
  "You are a direct-response ad reviewer. Score conversion potential 0-100 across " +
  "five dimensions: hook strength, clarity, specificity, benefit/emotional appeal, " +
  "and CTA strength.\n\n" +
  "Calibrate exactly like this:\n" +
  "  • 40-59 — weak: generic or vague, fails multiple dimensions\n" +
  "  • 60-74 — mediocre: one decent angle, soft on most dimensions\n" +
  "  • 75-84 — good, but ONE clearly weak dimension holds it back\n" +
  "  • 85-89 — strong on every dimension, but one is only adequate, not sharp\n" +
  "  • 90-97 — strong on ALL FIVE dimensions with no weakness that would lower " +
  "conversion: a scroll-stopping hook, a concrete specific, real emotional pull, " +
  "instant clarity, and an urgent low-risk CTA\n\n" +
  "Award 90+ whenever the copy genuinely nails all five — do NOT withhold it just " +
  "because trivial wording tweaks are imaginable; real ads rarely need them. Reserve " +
  "98-100 for flawless copy. Do not inflate weak copy.\n\n" +
  "List 0-3 concrete improvements — return an EMPTY list when the copy is already " +
  "excellent (90+).\n\n" +
  "Also give a predictedCtrBand and conversionLikelihood. These are estimates from " +
  "copy quality alone (no historical data) — calibrate them honestly and consistently " +
  "with the numeric score, don't just default to the top band.";

/** Score one ad creative's copy for conversion potential using Claude. */
export async function scoreCreative(
  input: CreativeScoreInput,
): Promise<CreativeScore> {
  const { object } = await generateObject({
    model: strategistModel,
    schema: creativeScoreSchema,
    system: SYSTEM,
    prompt: [
      input.productName ? `Product: ${input.productName}` : null,
      input.type ? `Format: ${input.type}` : null,
      input.concept ? `Concept: ${input.concept}` : null,
      `Headline: ${input.headline ?? "(none)"}`,
      `Primary text: ${input.primaryText ?? "(none)"}`,
      `CTA: ${input.callToAction ?? "(none)"}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return object;
}
