import { generateObject } from "ai";
import { strategistModel } from "./models";
import { strategySchema, type Strategy } from "./strategy-schema";
import type { MarketResearch } from "./research-schema";

export interface BriefInput {
  productName: string;
  productDescription?: string | null;
  goal: string;
  audience?: string | null;
  budget?: string | null;
  tone?: string | null;
  /** Brand name + identity context, pulled from the selected brand profile. */
  brandName?: string | null;
  brandDescription?: string | null;
  /** Brand primary color (#rrggbb) — guides the background scene palette. */
  brandColor?: string | null;
  /** Landing page the launched ad clicks through to (required to go live). */
  websiteUrl?: string | null;
  /**
   * Click destination: "website" (default) or "whatsapp" — a click-to-WhatsApp
   * ad opening a chat with the Page's WhatsApp Business number.
   */
  destination?: "website" | "whatsapp" | null;
  /** Target countries (ISO-3166 alpha-2), as an array or comma-separated string. */
  geoCountries?: string[] | string | null;
}

const SYSTEM_PROMPT =
  "You are an expert performance-marketing strategist for Meta and TikTok ads. " +
  "Given a product brief, produce a concise, actionable campaign strategy plus 2-4 " +
  "distinct ad creative concepts. Be specific and concrete — no filler.\n\n" +
  "For each creative's `creativePrompt` field: write a STATIC BACKGROUND IMAGE prompt " +
  "for FLUX Schnell (a fast text-to-image model). The prompt describes the BACKGROUND " +
  "SCENE behind the ad copy — NOT the product itself and NOT the headline text. " +
  "Ad copy (headline, CTA) will be overlaid on top by the design system.\n\n" +
  "Good FLUX Schnell background prompts:\n" +
  "- Describe a scene, mood, texture, or setting that fits the product category\n" +
  "- Include lighting style: soft diffused light, golden hour, studio lighting, etc.\n" +
  "- Include visual style: photorealistic, editorial, minimalist, lifestyle photography\n" +
  "- Keep it concrete (30–80 words), no abstract concepts, no text in the image\n" +
  "- Do NOT describe motion, video effects, camera movements, or transitions\n" +
  "Example: 'Clean white marble surface with scattered fresh herbs and olive oil, " +
  "soft natural side lighting, editorial food photography, minimal negative space, " +
  "Mediterranean lifestyle aesthetic'.";

/**
 * Turn a product brief into a structured marketing strategy using Claude.
 * When market research is provided, the strategy is grounded in it.
 */
export async function generateStrategy(
  brief: BriefInput,
  research?: MarketResearch | null,
): Promise<Strategy> {
  // Note: no temperature/top_p — removed on Opus 4.8 (would 400).
  const { object } = await generateObject({
    model: strategistModel,
    schema: strategySchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(brief, research),
  });
  return object;
}

function summarizeResearch(r: MarketResearch): string {
  const competitors = r.competitors
    .map((c) => `- ${c.name}: ${c.positioning} (gap: ${c.gaps})`)
    .join("\n");
  const personas = r.audiencePersonas
    .map(
      (p) =>
        `- ${p.name}: ${p.description} | pains: ${p.painPoints.join(", ")} | hooks: ${p.messagingHooks.join(", ")}`,
    )
    .join("\n");
  return [
    "MARKET RESEARCH (ground your strategy in this):",
    `Market: ${r.marketOverview}`,
    `Competitors:\n${competitors}`,
    `Audience personas:\n${personas}`,
    `Opportunities: ${r.opportunities.join("; ")}`,
    `Recommended channels: ${r.recommendedChannels.join(", ")}`,
  ].join("\n");
}

function buildPrompt(brief: BriefInput, research?: MarketResearch | null): string {
  return [
    brief.brandName ? `Brand: ${brief.brandName}` : null,
    `Product: ${brief.productName}`,
    brief.productDescription ? `Description: ${brief.productDescription}` : null,
    `Campaign goal: ${brief.goal}`,
    brief.audience ? `Target audience: ${brief.audience}` : null,
    brief.budget ? `Budget: ${brief.budget}` : null,
    brief.tone ? `Brand voice / tone (write all copy in this voice): ${brief.tone}` : null,
    brief.brandDescription ? `Brand context: ${brief.brandDescription}` : null,
    brief.brandColor ? `Brand color palette: ${brief.brandColor} — subtly reflect this palette in the background scenes.` : null,
    research ? `\n${summarizeResearch(research)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
