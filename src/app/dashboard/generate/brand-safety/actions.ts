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

const issueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]).describe("How serious the issue is"),
  category: z
    .enum(["off-voice", "unsupported-claim", "compliance", "cultural-sensitivity", "platform-policy", "clarity"])
    .describe("What kind of issue this is"),
  quote: z.string().describe("The exact phrase from the copy that triggered the flag (verbatim, in its original language)"),
  explanation: z.string().describe("Why this is a problem for this brand/market"),
  suggestedFix: z.string().describe("A concrete rewrite or fix for this specific phrase"),
});

const brandSafetySchema = z.object({
  score: z.number().min(0).max(100).describe("Overall brand-safety + on-voice score, 0-100"),
  verdict: z.enum(["pass", "review", "fail"]).describe("pass = ship it, review = fix flagged issues first, fail = do not ship"),
  summary: z.string().describe("One-paragraph verdict explaining the score"),
  issues: z.array(issueSchema).describe("Every issue found, most severe first (empty array if the copy is clean)"),
  strengths: z.array(z.string()).min(1).max(4).describe("What the copy does well / stays on-voice"),
  revisedCopy: z.string().describe("A cleaned-up version of the full copy that resolves the issues while keeping the intent"),
});

export type SafetyIssue = z.infer<typeof issueSchema>;
export type BrandSafetyResult = z.infer<typeof brandSafetySchema>;

export type BrandSafetyState =
  | { status: "idle" }
  | { status: "success"; result: BrandSafetyResult; generationId: string }
  | { status: "error"; message: string };

export async function checkBrandSafety(
  _prev: BrandSafetyState,
  formData: FormData,
): Promise<BrandSafetyState> {
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

  const copy = field("copy");
  if (!copy) return { status: "error", message: "Paste the copy you want checked." };

  const brand = readBrandContext(formData, savedInput);
  const brandProfileId = brand.brandProfileId ?? (parent?.brandProfileId ?? null);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");
  const platform = field("platform");
  const market = field("market") ?? "Morocco / MENA";

  const prompt = [
    languageDirective(language, dialect),
    `Write your analysis (summary, explanations, fixes, strengths) in that language. Keep each "quote" field verbatim in the copy's ORIGINAL language.`,
    ...brand.lines,
    `Target market: ${market}`,
    platform && `Destination platform: ${platform}`,
    `\nReview this ad/marketing copy for brand safety and check it stays on-voice:`,
    `"""`,
    copy,
    `"""`,
    `\nFlag: off-brand-voice phrasing; unsupported or exaggerated claims; ad-compliance risks (misleading, superlatives, guarantees); cultural or religious sensitivity for the target market; platform ad-policy risks; and clarity problems.`,
    `Be strict but fair — do not invent issues. If the copy is clean, return an empty issues array and a high score.`,
    parent && feedback ? refineDirective(parent.output, feedback) : null,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: brandSafetySchema,
      system:
        "You are a brand-safety and ad-compliance reviewer. You catch off-voice copy, unsupported claims, " +
        "policy risks, and cultural insensitivity before an ad ships — with special attention to Muslim-majority " +
        "MENA audiences (avoid religiously inappropriate framing, respect local norms). You are precise and never fabricate issues.",
      prompt,
    });

    const generationId = await saveGeneration({
      orgId: org.id,
      tool: "brand-safety",
      brandProfileId,
      input: { ...brand.fields, copy, platform, market, language, dialect },
      output: object,
      parentId: parent?.id ?? null,
      feedback: parent ? feedback : null,
    });

    return { status: "success", result: object, generationId: generationId ?? "" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Check failed",
    };
  }
}
