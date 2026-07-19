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

const emailStepSchema = z.object({
  step: z.number().int().min(1).describe("1-based position in the sequence"),
  purpose: z.string().describe("What this specific email is for, e.g. 'Welcome', 'Reminder', 'Last chance'"),
  timing: z.string().describe("When to send relative to the trigger, e.g. 'Immediately', 'Day 2', '48h after cart abandon'"),
  subjectOptions: z.array(z.string()).min(2).max(3).describe("2-3 A/B subject line options for this email"),
  preheader: z.string().describe("Preview text shown after the subject in the inbox"),
  body: z.string().describe("Full email body in the brand voice and output language — greeting, hook, value, and a clear ask. Plain text with line breaks."),
  cta: z.string().describe("The primary call-to-action button/link label"),
});

const emailResultSchema = z.object({
  strategy: z.string().describe("One-paragraph explanation of the approach for this email/sequence"),
  emails: z.array(emailStepSchema).min(1).max(6).describe("The email(s) — one for a single send, several for a sequence"),
  tips: z.array(z.string()).min(2).max(4).describe("Deliverability and optimization tips specific to this send"),
});

export type EmailStep = z.infer<typeof emailStepSchema>;
export type EmailResult = z.infer<typeof emailResultSchema>;

export type EmailState =
  | { status: "idle" }
  | { status: "success"; result: EmailResult; productName: string; generationId: string }
  | { status: "error"; message: string };

const EMAIL_TYPES: Record<string, string> = {
  single: "a single standalone promotional email",
  welcome: "a 3-email welcome sequence for new subscribers",
  "abandoned-cart": "a 3-email abandoned-cart recovery sequence",
  launch: "a product-launch sequence of 3-4 emails (teaser, launch, follow-up)",
  reengagement: "a 2-3 email win-back sequence for lapsed customers",
  newsletter: "a single newsletter-style email",
};

export async function generateEmail(
  _prev: EmailState,
  formData: FormData,
): Promise<EmailState> {
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
  const typeKey = field("emailType") ?? "single";
  const emailType = EMAIL_TYPES[typeKey] ?? EMAIL_TYPES.single;

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("audience") && `Audience: ${field("audience")}`,
    field("offer") && `Offer / angle: ${field("offer")}`,
    `\nWrite ${emailType} for this product.`,
    `Match the number of emails to the type. Each email needs 2-3 A/B subject lines, a preheader, a full body in the brand voice, and a clear CTA.`,
    `Subject lines must earn the open without clickbait; bodies must be skimmable and lead to one clear action.`,
    parent && feedback ? refineDirective(parent.output, feedback) : null,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: emailResultSchema,
      system:
        "You are an email marketing specialist. You write high-open, high-click emails and sequences that " +
        "sound human and on-brand, never spammy. You know inbox mechanics: subject + preheader do the opening, " +
        "the body does one job, and the CTA is unmistakable.",
      prompt,
    });

    const generationId = await saveGeneration({
      orgId: org.id,
      tool: "email-marketing",
      brandProfileId,
      input: { productName, description: field("description"), audience: field("audience"), offer: field("offer"), emailType: typeKey, language, dialect },
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
