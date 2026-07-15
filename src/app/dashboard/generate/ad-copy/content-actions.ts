"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";
import { languageDirective } from "@/lib/ai/languages";

/* ── Product Descriptions ─────────────────────────────────────────────── */

const productDescriptionSchema = z.object({
  short: z.string().describe("Under 160 characters — for product cards / search snippets"),
  medium: z.string().describe("2-3 sentences — for a standard product page"),
  long: z.string().describe("A full SEO-friendly paragraph covering features, benefits, and use case"),
  bulletPoints: z.array(z.string()).min(4).max(6).describe("Scannable feature/benefit bullets"),
  seoKeywords: z.array(z.string()).min(5).max(8),
  metaTitle: z.string().describe("Under 60 characters — HTML <title>"),
  metaDescription: z.string().describe("Under 160 characters — HTML meta description"),
});

export type ProductDescriptionResult = z.infer<typeof productDescriptionSchema>;

export type ProductDescriptionState =
  | { status: "idle" }
  | { status: "success"; result: ProductDescriptionResult; productName: string }
  | { status: "error"; message: string };

export async function generateProductDescription(
  _prev: ProductDescriptionState,
  formData: FormData,
): Promise<ProductDescriptionState> {
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

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product: ${productName}`,
    field("features")  && `Key features / materials: ${field("features")}`,
    field("audience")  && `Target audience: ${field("audience")}`,
    field("keywords")  && `SEO keywords to consider: ${field("keywords")}`,
    `\nWrite product-page copy in three lengths (short/medium/long), plus scannable bullets and SEO metadata.`,
    `Be concrete and sensory — describe what the product actually does, not vague adjectives.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: productDescriptionSchema,
      system:
        "You are an e-commerce copywriter and SEO specialist. Write product descriptions that " +
        "convert browsers into buyers while remaining genuinely informative and keyword-rich.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "product-description",
      brandProfileId: brand.brandProfileId,
      input: { productName, features: field("features"), audience: field("audience"), keywords: field("keywords"), language, dialect },
      output: object,
    });

    return { status: "success", result: object, productName };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed" };
  }
}

/* ── Marketing Copy ────────────────────────────────────────────────────── */

const marketingPieceSchema = z.object({
  format: z.string(),
  headline: z.string().optional().describe("Subject line / headline, when the format has one"),
  body: z.string().describe("The main copy for this format"),
});

const marketingCopyResultSchema = z.object({
  pieces: z.array(marketingPieceSchema).min(1).max(4),
});

export type MarketingPiece = z.infer<typeof marketingPieceSchema>;
export type MarketingCopyResult = z.infer<typeof marketingCopyResultSchema>;

export type MarketingCopyState =
  | { status: "idle" }
  | { status: "success"; result: MarketingCopyResult; productName: string }
  | { status: "error"; message: string };

export async function generateMarketingCopy(
  _prev: MarketingCopyState,
  formData: FormData,
): Promise<MarketingCopyState> {
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

  const formats = (formData.getAll("formats") as string[]).filter(Boolean);
  if (formats.length === 0) return { status: "error", message: "Select at least one format." };

  const brand = readBrandContext(formData);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product / campaign: ${productName}`,
    field("goal")   && `Goal: ${field("goal")}`,
    field("offer")  && `Offer / promotion: ${field("offer")}`,
    field("audience") && `Audience: ${field("audience")}`,
    `\nWrite one piece of copy for each of these formats: ${formats.join(", ")}.`,
    `Match each format's natural length and register — an email is not a text message.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: marketingCopyResultSchema,
      system:
        "You are a senior marketing copywriter who writes across channels — email, landing pages, " +
        "blogs, and SMS. Each format has its own voice and constraints; respect them.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "marketing-copy",
      brandProfileId: brand.brandProfileId,
      input: { productName, goal: field("goal"), offer: field("offer"), audience: field("audience"), formats, language, dialect },
      output: object,
    });

    return { status: "success", result: object, productName };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed" };
  }
}
