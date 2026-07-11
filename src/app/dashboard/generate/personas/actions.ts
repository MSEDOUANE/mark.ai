"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";

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
  | { status: "success"; result: PersonasResult; productName: string }
  | { status: "error"; message: string };

export async function generatePersonas(
  _prev: PersonasState,
  formData: FormData,
): Promise<PersonasState> {
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
    field("description")  && `Description: ${field("description")}`,
    field("market")       && `Target market / geography: ${field("market")}`,
    field("pricePoint")   && `Price point: ${field("pricePoint")}`,
    field("audience")     && `Known audience info: ${field("audience")}`,
    `\nGenerate 3-4 realistic, distinct buyer personas for this product.`,
    `Each persona must be a real archetype — not a demographic bucket.`,
    `Make them feel like actual people: specific, vivid, internally consistent.`,
    `The messaging angles and example hook must be directly actionable for ad campaigns.`,
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

    await saveGeneration({
      orgId: org.id,
      tool: "personas",
      brandProfileId: brand.brandProfileId,
      input: {
        productName,
        description: field("description"),
        market: field("market"),
        pricePoint: field("pricePoint"),
        audience: field("audience"),
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
