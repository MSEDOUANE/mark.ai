"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";

const captionVariantSchema = z.object({
  caption: z.string().describe("Full caption text — natural, platform-appropriate, without hashtags"),
  hashtags: z.array(z.string()).describe("5-10 relevant hashtags WITHOUT the # prefix"),
  emojiLine: z.string().describe("1-3 relevant emojis that complement the caption tone"),
  angle: z.string().describe("Short label for this variant's angle, e.g. 'Benefit-led', 'Behind the scenes'"),
});

const socialCaptionsResultSchema = z.object({
  variants: z.array(captionVariantSchema).min(4).max(6),
  platformTips: z.array(z.string()).min(2).max(3).describe("Quick tips specific to this platform"),
  bestPostingTimes: z.string().describe("Best days/times to post on this platform for this audience"),
});

export type CaptionVariant      = z.infer<typeof captionVariantSchema>;
export type SocialCaptionsResult = z.infer<typeof socialCaptionsResultSchema>;

export type SocialCaptionsState =
  | { status: "idle" }
  | { status: "success"; result: SocialCaptionsResult; platform: string; productName: string }
  | { status: "error"; message: string };

const PLATFORM_GUIDANCE: Record<string, string> = {
  Instagram: "Instagram captions can be longer (up to 2200 chars). Use line breaks. End with a CTA. Hashtags go at the bottom.",
  TikTok:    "TikTok captions should be short, punchy, and conversational. Use 3-5 hashtags max. Hook in the first line.",
  Facebook:  "Facebook rewards conversational, story-driven captions. Medium length. Ask a question to drive comments.",
  LinkedIn:  "LinkedIn captions should be professional but personal. Use whitespace generously. Short paragraphs. No hashtag spam.",
  X:         "X (Twitter) needs brevity under 280 chars. Punchy, witty, shareable. One strong CTA. Minimal hashtags.",
  Pinterest: "Pinterest captions should be keyword-rich and descriptive. Inspire action. Include search-friendly phrases.",
};

export async function generateSocialCaptions(
  _prev: SocialCaptionsState,
  formData: FormData,
): Promise<SocialCaptionsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  function field(key: string) {
    const v = String(formData.get(key) ?? "").trim();
    return v || null;
  }

  const productName = field("productName");
  const platform    = field("platform") ?? "Instagram";
  if (!productName) return { status: "error", message: "Product name is required." };

  const guidance = PLATFORM_GUIDANCE[platform] ?? "";
  const brand = readBrandContext(formData);

  const prompt = [
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("keyMessage")  && `Key message / offer: ${field("keyMessage")}`,
    field("audience")    && `Target audience: ${field("audience")}`,
    field("tone")        && `Tone for this batch: ${field("tone")}`,
    `Platform: ${platform}`,
    `\nPlatform guidance: ${guidance}`,
    `\nGenerate 4-6 distinct caption variants. Each must have a different angle and feel.`,
    `Do NOT repeat copy across variants. Make each one feel like it was written by a different person.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: socialCaptionsResultSchema,
      system:
        `You are a social media content expert who writes viral, platform-native captions. ` +
        `Write captions that feel authentic, not corporate. Vary the angles: some benefit-led, ` +
        `some story-driven, some behind-the-scenes, some question-based.`,
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "social-captions",
      brandProfileId: brand.brandProfileId,
      input: {
        productName,
        platform,
        description: field("description"),
        keyMessage: field("keyMessage"),
        audience: field("audience"),
        tone: field("tone"),
      },
      output: object,
    });

    return { status: "success", result: object, platform, productName };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed",
    };
  }
}
