import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "./models";

/**
 * Structured landing-page content — the AI fills this schema; the fixed
 * template at /p/[slug] renders it. Keeping the AI away from raw HTML gives
 * consistent, safe, on-brand pages.
 */
export const landingSchema = z.object({
  heroHeadline: z.string().describe("Punchy hero headline, ≤60 chars"),
  heroSubheadline: z
    .string()
    .describe("1-2 sentence supporting line under the headline"),
  ctaLabel: z.string().describe("CTA button label, ≤25 chars, e.g. 'Order on WhatsApp'"),
  benefits: z
    .array(
      z.object({
        title: z.string().describe("3-5 word benefit title"),
        description: z.string().describe("One concrete sentence"),
      }),
    )
    .min(3)
    .max(4),
  offer: z
    .string()
    .describe("The offer/value line shown above the final CTA — concrete, no invented discounts"),
  socialProof: z
    .string()
    .describe("One credibility line (craftsmanship, materials, origin — never fake reviews or numbers)"),
  faq: z
    .array(
      z.object({
        q: z.string(),
        a: z.string().describe("2-3 sentence answer"),
      }),
    )
    .min(3)
    .max(4),
});

export type LandingContent = z.infer<typeof landingSchema>;

export interface LandingInput {
  productName: string;
  productDescription?: string | null;
  audience?: string | null;
  brandName?: string | null;
  brandDescription?: string | null;
  tone?: string | null;
  /** "whatsapp" biases CTA copy toward chat-to-order. */
  ctaKind: "whatsapp" | "link";
}

export async function generateLandingContent(
  input: LandingInput,
): Promise<LandingContent> {
  const { object } = await generateObject({
    model: strategistModel,
    schema: landingSchema,
    system:
      "You write high-converting product landing pages. Direct-response principles: " +
      "concrete benefits over features, one clear action, zero filler. Never invent " +
      "prices, discounts, reviews, or statistics. Write in the brand voice given.",
    prompt: [
      input.brandName ? `Brand: ${input.brandName}` : null,
      input.tone ? `Brand voice (write everything in this voice): ${input.tone}` : null,
      input.brandDescription ? `Brand context: ${input.brandDescription}` : null,
      `Product: ${input.productName}`,
      input.productDescription ? `Description: ${input.productDescription}` : null,
      input.audience ? `Audience: ${input.audience}` : null,
      input.ctaKind === "whatsapp"
        ? "The CTA opens a WhatsApp chat to order/ask — write CTA copy accordingly."
        : "The CTA follows a link — write CTA copy accordingly.",
      "Write the landing page content.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return object;
}
