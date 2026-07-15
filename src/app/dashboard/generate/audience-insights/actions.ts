"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";

const segmentSchema = z.object({
  name: z.string().describe("Short label for this audience segment, e.g. 'Budget-conscious new parents'"),
  description: z.string().describe("1-2 sentences on who this segment is and why they'd buy"),
  sizeSignal: z.enum(["Large", "Medium", "Niche"]).describe("Relative size of this segment in the target market"),
  demographics: z.object({
    ageRange: z.string().describe("e.g. '25-34'"),
    gender: z.string().describe("e.g. 'Skews female' or 'Balanced'"),
    incomeLevel: z.string().describe("e.g. 'Middle income' or '15 000-30 000 MAD/month'"),
    location: z.string().describe("Where this segment concentrates geographically"),
  }),
  interests: z.array(z.string()).min(3).max(6),
  onlineBehavior: z.array(z.string()).min(2).max(4).describe("How they browse/shop/research online"),
  painPoints: z.array(z.string()).min(2).max(4),
  preferredChannels: z.array(z.enum(["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "WhatsApp", "Pinterest", "Google Search"])),
});

const audienceInsightsSchema = z.object({
  marketSummary: z.string().describe("One paragraph on the overall addressable audience"),
  segments: z.array(segmentSchema).min(3).max(5),
  opportunityGap: z.string().describe("An underserved angle or segment competitors are missing"),
  recommendedFocus: z.string().describe("Which segment to prioritize first and why"),
});

export type AudienceSegment = z.infer<typeof segmentSchema>;
export type AudienceInsightsResult = z.infer<typeof audienceInsightsSchema>;

export type AudienceInsightsState =
  | { status: "idle" }
  | { status: "success"; result: AudienceInsightsResult; productName: string }
  | { status: "error"; message: string };

export async function generateAudienceInsights(
  _prev: AudienceInsightsState,
  formData: FormData,
): Promise<AudienceInsightsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  function field(key: string) {
    const v = String(formData.get(key) ?? "").trim();
    return v || null;
  }

  const productName = field("productName");
  if (!productName) return { status: "error", message: "Product name is required." };

  const brand = readBrandContext(formData);

  const prompt = [
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("market")      && `Target market / geography: ${field("market")}`,
    field("competitors") && `Known competitors: ${field("competitors")}`,
    `\nBreak the addressable market into 3-5 distinct audience segments for this product.`,
    `Segments must be genuinely different from each other — not slices of the same demographic.`,
    `Ground every detail in realistic online behavior and buying psychology, not generic marketing buckets.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: audienceInsightsSchema,
      system:
        "You are a senior audience research analyst for performance marketing. " +
        "Segment markets the way a media buyer would — by behavior and intent, not just demographics. " +
        "Every segment must be actionable: specific enough to target and message differently.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "audience-insights",
      brandProfileId: brand.brandProfileId,
      input: {
        productName,
        description: field("description"),
        market: field("market"),
        competitors: field("competitors"),
      },
      output: object,
    });

    return { status: "success", result: object, productName };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed",
    };
  }
}
