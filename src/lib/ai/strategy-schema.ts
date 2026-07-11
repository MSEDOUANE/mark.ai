import { z } from "zod";

/** A single ad creative concept the strategist proposes. */
export const creativeConceptSchema = z.object({
  concept: z.string().describe("Short name of the creative angle/concept"),
  type: z.enum(["image", "video"]),
  template: z
    .enum(["overlay", "split", "bold"])
    .describe(
      "Visual design template: 'overlay' = full-bleed image with text at bottom (lifestyle/emotion), 'split' = two-panel editorial with image left and text right (product/feature), 'bold' = centered giant headline on gradient (announcement/offer)",
    ),
  headline: z.string().describe("Punchy ad headline (~40 chars)"),
  primaryText: z.string().describe("Primary ad body copy, 1-3 sentences"),
  callToAction: z
    .string()
    .describe("Call-to-action label, e.g. 'Shop Now', 'Learn More'"),
  creativePrompt: z
    .string()
    .describe(
      "FLUX Schnell background image prompt (30-80 words). Describes a SCENE or SETTING " +
      "that works as the ad background — the design system overlays the headline/CTA on top. " +
      "Include scene details, lighting style (soft natural, studio, golden hour), and visual " +
      "style (photorealistic, editorial, lifestyle). No text in image, no motion/video language.",
    ),
});

/** The full marketing strategy the AI produces from a brief. */
export const strategySchema = z.object({
  positioning: z.string().describe("One-paragraph positioning statement"),
  targetAudience: z.object({
    summary: z.string(),
    segments: z.array(z.string()).describe("2-4 distinct audience segments"),
  }),
  channels: z
    .array(
      z.object({
        platform: z.enum(["meta", "tiktok"]),
        rationale: z.string(),
      }),
    )
    .describe("Recommended ad channels, each with a rationale"),
  keyMessages: z.array(z.string()).describe("3-5 key marketing messages"),
  budgetRationale: z
    .string()
    .describe(
      "Explain the budget recommendation: why this daily/monthly amount makes sense for this product, audience size, market, and objective. Reference typical CPCs/CPMs for the platform and geography, estimated reach, and what the budget buys in terms of test data. Be specific — not generic advice.",
    ),
  creatives: z
    .array(creativeConceptSchema)
    .describe("2 to 4 distinct ad creative concepts to generate"),
});

export type Strategy = z.infer<typeof strategySchema>;
export type CreativeConcept = z.infer<typeof creativeConceptSchema>;
