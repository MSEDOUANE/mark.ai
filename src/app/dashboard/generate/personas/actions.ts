"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import {
  readBrandContext,
  saveGeneration,
  loadRefineParent,
  readRefineFeedback,
  refineDirective,
} from "@/lib/ai/tool-context";
import { languageDirective } from "@/lib/ai/languages";

const personaSchema = z.object({
  name:         z.string().describe("Fictional first name that feels real for this demographic"),
  age:          z.number().int().min(18).max(75),
  occupation:   z.string(),
  location:     z.string().describe("City or region — be specific"),
  income:       z.string().describe("Income range, e.g. '25 000–40 000 MAD/month'"),
  photoDescription: z.string().describe("One sentence describing how this person would look in a stock photo"),
  goals: z.array(z.string()).min(2).max(3).describe("What they want to achieve — relevant to your product"),
  painPoints: z.array(z.string()).min(2).max(3).describe("Frustrations your product solves"),
  motivations: z.string().describe("Core underlying motivation that drives purchases like this"),
  preferredPlatforms: z.array(z.enum(["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "WhatsApp", "Pinterest"]))
    .describe("Platforms they actually spend time on"),
  adReceptiveness: z.string().describe("What makes an ad resonate with this persona — be specific"),
  messagingAngles: z.array(z.string()).min(2).max(3).describe("Most effective ad angles for this persona"),
  exampleHook: z.string().describe("A scroll-stopping ad hook written specifically for this persona"),
  quote: z.string().describe("A candid quote this persona might say about the problem your product solves"),
  metaTargeting: z.object({
    ageMin: z.number().int().min(13).max(65),
    ageMax: z.number().int().min(13).max(65),
    genders: z.array(z.enum(["all", "male", "female"])).min(1),
    interests: z.array(z.string()).min(4).max(10).describe("Meta Ads interest-targeting keywords (e.g. 'Online shopping', 'Sustainable living')"),
    detailedTargeting: z.array(z.string()).min(2).max(6).describe("Behaviors or demographics Meta lets you layer in (e.g. 'Engaged shoppers', 'Frequent travelers')"),
    placements: z.array(z.enum(["Feed", "Stories", "Reels", "Marketplace", "Right column", "Audience Network"])).min(2),
  }).describe("A ready-to-use Meta Ads Manager targeting spec for this persona"),
});

const personasResultSchema = z.object({
  personas: z.array(personaSchema).min(3).max(4),
  audienceSummary: z.string().describe("One-paragraph summary of the total addressable audience"),
  sharedPainPoint: z.string().describe("The one pain point ALL personas share — your universal message"),
  recommendedPrimary: z.string().describe("Which persona name to prioritize and why"),
});

export type Persona        = z.infer<typeof personaSchema>;
export type PersonasResult = z.infer<typeof personasResultSchema>;

export type PersonasState =
  | { status: "idle" }
  | { status: "success"; result: PersonasResult; productName: string; generationId: string }
  | { status: "error"; message: string };

export async function generatePersonas(
  _prev: PersonasState,
  formData: FormData,
): Promise<PersonasState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const parent = await loadRefineParent(formData, org.id);
  const feedback = readRefineFeedback(formData);
  const savedInput = (parent?.input ?? {}) as Record<string, unknown>;

  function field(key: string): string | null {
    const v = String(formData.get(key) ?? "").trim();
    if (v) return v;
    const saved = savedInput[key];
    return typeof saved === "string" && saved ? saved : null;
  }

  const productName = field("productName");
  if (!productName) return { status: "error", message: "Product name is required." };

  const brand = readBrandContext(formData);
  const brandProfileId = brand.brandProfileId ?? (parent?.brandProfileId ?? null);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");

  const prompt = [
    `${languageDirective(language, dialect)} Applies to names, quotes, hooks, and messaging ` +
      `angles — but keep metaTargeting.interests and detailedTargeting in English exactly as ` +
      `Meta Ads Manager defines them, since those are pasted directly into ad set targeting.`,
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description")  && `Description: ${field("description")}`,
    field("market")       && `Target market / geography: ${field("market")}`,
    field("pricePoint")   && `Price point: ${field("pricePoint")}`,
    field("audience")     && `Known audience info: ${field("audience")}`,
    `\nGenerate 3-4 realistic, distinct buyer personas for this product.`,
    `Each persona must be a real archetype — not a demographic bucket.`,
    `Make them feel like actual people: specific, vivid, internally consistent.`,
    `The messaging angles and example hook must be directly actionable for ad campaigns.`,
    `For each persona, also produce a realistic Meta Ads Manager targeting spec: an age ` +
      `range, genders, 4-10 specific interest-targeting keywords Meta actually offers, ` +
      `and 2-6 detailed-targeting behaviors/demographics — ready to paste into an ad set.`,
    parent && feedback ? refineDirective(parent.output, feedback) : null,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: personasResultSchema,
      system:
        "You are a senior brand strategist and consumer psychologist. " +
        "Create buyer personas that are specific enough to write ads to, " +
        "not generic marketing demographics. Ground every detail in real human psychology.",
      prompt,
    });

    const generationId = await saveGeneration({
      orgId: org.id,
      tool: "personas",
      brandProfileId,
      input: {
        productName,
        description: field("description"),
        market: field("market"),
        pricePoint: field("pricePoint"),
        audience: field("audience"),
        language,
        dialect,
      },
      output: object,
      parentId: parent?.id ?? null,
      feedback: parent ? feedback : null,
    });

    return { status: "success", result: object, productName, generationId: generationId ?? "" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed",
    };
  }
}
