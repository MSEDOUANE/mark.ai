"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";
import { languageDirective } from "@/lib/ai/languages";

const stageSchema = z.object({
  stage: z.enum(["TOFU", "MOFU", "BOFU"]).describe("Funnel stage: TOFU=awareness, MOFU=consideration, BOFU=conversion"),
  label: z.string().describe("Human name for the stage in the output language, e.g. 'Awareness'"),
  objective: z.string().describe("What this stage is trying to achieve"),
  audienceState: z.string().describe("The mindset / awareness level of the audience at this stage"),
  messagingAngles: z.array(z.string()).min(2).max(4).describe("Distinct messaging angles for this stage"),
  adFormats: z.array(z.string()).min(2).max(4).describe("Ad formats that fit this stage, e.g. short video, carousel, testimonial"),
  sampleHook: z.string().describe("One concrete example headline/hook written in the brand voice and output language"),
  cta: z.string().describe("Stage-appropriate call to action"),
  primaryKpi: z.string().describe("The main metric to judge this stage by, e.g. reach, CTR, ROAS"),
});

const funnelSchema = z.object({
  overview: z.string().describe("One paragraph on the overall funnel strategy for this product"),
  budgetSplit: z.string().describe("Suggested budget split across the three stages, e.g. '50% TOFU / 30% MOFU / 20% BOFU', with a one-line reason"),
  stages: z.array(stageSchema).length(3).describe("Exactly three stages in order: TOFU, MOFU, BOFU"),
  localPlaybook: z.array(z.string()).min(1).max(5).describe("Market-specific conversion tactics — for Morocco/MENA include COD (cash-on-delivery) trust-building, WhatsApp follow-up, and cart-abandonment recovery where relevant"),
});

export type FunnelStage = z.infer<typeof stageSchema>;
export type FunnelResult = z.infer<typeof funnelSchema>;

export type FunnelState =
  | { status: "idle" }
  | { status: "success"; result: FunnelResult; productName: string }
  | { status: "error"; message: string };

export async function generateFunnel(
  _prev: FunnelState,
  formData: FormData,
): Promise<FunnelState> {
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
  const language = field("language") ?? "ar";
  const dialect = field("dialect");
  const market = field("market") ?? "Morocco / MENA";
  const destination = field("destination");

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("audience") && `Target audience: ${field("audience")}`,
    field("goal") && `Campaign goal: ${field("goal")}`,
    `Primary market: ${market}`,
    destination && `Primary conversion destination: ${destination}`,
    `\nDesign a full-funnel ad strategy across three stages: TOFU (awareness), MOFU (consideration), BOFU (conversion).`,
    `Each stage must have a distinct objective, audience mindset, messaging angles, ad formats, a sample hook, CTA, and primary KPI.`,
    `The stages should tell one coherent story that moves a stranger to a buyer — not three disconnected campaigns.`,
    `For the local playbook, account for how this market actually converts: in Morocco/MENA that means cash-on-delivery (COD) trust-building, WhatsApp-based follow-up and objection handling, and cart-abandonment recovery.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: funnelSchema,
      system:
        "You are a performance-marketing strategist who designs full-funnel ad journeys (TOFU/MOFU/BOFU). " +
        "You know that emerging markets like Morocco convert differently — COD, WhatsApp, and trust are decisive at BOFU. " +
        "Every stage you design is specific and executable, never generic funnel theory.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "funnel-design",
      brandProfileId: brand.brandProfileId,
      input: { productName, description: field("description"), audience: field("audience"), goal: field("goal"), market, destination, language, dialect },
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
