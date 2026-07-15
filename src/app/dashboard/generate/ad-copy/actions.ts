"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";
import { languageDirective } from "@/lib/ai/languages";

const copyVariantSchema = z.object({
  framework: z.string().describe("Framework name, e.g. 'AIDA', 'PAS'"),
  headline: z.string().describe("Punchy headline under 40 characters"),
  primaryText: z.string().describe("Body copy, 2-4 sentences. Conversational, benefit-driven."),
  callToAction: z.string().describe("CTA label, under 25 characters, e.g. 'Shop Now'"),
  hook: z.string().describe("One-sentence opening hook or scroll-stopper for the ad"),
});

const adCopyResultSchema = z.object({
  variants: z.array(copyVariantSchema).min(3).max(8),
  writingTips: z.array(z.string()).min(2).max(4).describe("2-4 concise tips to improve this copy further"),
});

export type AdCopyVariant = z.infer<typeof copyVariantSchema>;
export type AdCopyResult  = z.infer<typeof adCopyResultSchema>;

export type AdCopyState =
  | { status: "idle" }
  | { status: "success"; result: AdCopyResult; productName: string }
  | { status: "error"; message: string };

export async function generateAdCopy(
  _prev: AdCopyState,
  formData: FormData,
): Promise<AdCopyState> {
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

  const selectedFrameworks = formData.getAll("frameworks") as string[];
  const frameworks = selectedFrameworks.length
    ? selectedFrameworks
    : ["AIDA", "PAS", "Hook-Story-Offer", "Benefit-Led", "Social Proof"];

  const brand = readBrandContext(formData);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product: ${productName}`,
    field("productDescription") && `Description: ${field("productDescription")}`,
    field("goal")               && `Goal: ${field("goal")}`,
    field("audience")           && `Target audience: ${field("audience")}`,
    field("offer")              && `Current offer / promotion: ${field("offer")}`,
    field("tone")               && `Tone for this batch: ${field("tone")}`,
    `\nGenerate one copy variant for each of these frameworks: ${frameworks.join(", ")}.`,
    `Write for performance ads (Meta / Instagram). Be specific, concrete, benefit-driven.`,
    `Each variant must feel distinct — different angle, different emotion, different hook.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: adCopyResultSchema,
      system:
        "You are a senior direct-response copywriter specialising in social media ads. " +
        "Write punchy, conversion-focused copy using the requested frameworks. " +
        "Never be generic. Make every word earn its place.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "ad-copy",
      brandProfileId: brand.brandProfileId,
      input: {
        productName,
        productDescription: field("productDescription"),
        goal: field("goal"),
        audience: field("audience"),
        offer: field("offer"),
        tone: field("tone"),
        frameworks,
        language,
        dialect,
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
