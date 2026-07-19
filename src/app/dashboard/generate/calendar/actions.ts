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

const entrySchema = z.object({
  occasion: z.string().describe("Name of the seasonal moment, e.g. 'Ramadan', 'Aïd al-Fitr', 'Black Friday', 'Back to school', 'Summer sales'"),
  window: z.string().describe("Approximate date window in the planning horizon, e.g. 'approx. 18 Feb – 19 Mar 2026' or 'late August'"),
  type: z.enum(["religious", "cultural", "retail", "seasonal"]).describe("What kind of moment this is"),
  relevance: z.string().describe("Why this moment matters specifically for THIS product/brand — skip generic filler"),
  campaignAngle: z.string().describe("The concrete hook, offer, or message to run for this moment"),
  prepLeadTime: z.string().describe("How far ahead to start preparing, e.g. 'start creatives ~3 weeks before'"),
  priority: z.enum(["high", "medium", "low"]).describe("How important this moment is for this product"),
  suggestedChannels: z.array(z.string()).min(1).max(4).describe("Channels that fit this moment, e.g. Instagram, WhatsApp, TikTok"),
});

const calendarSchema = z.object({
  horizonSummary: z.string().describe("One paragraph framing the planning window and the biggest opportunities in it"),
  entries: z.array(entrySchema).min(4).max(10).describe("Seasonal moments ordered chronologically within the horizon"),
  quickWins: z.array(z.string()).min(1).max(4).describe("Nearest-term moments worth acting on immediately given the current date"),
});

export type CalendarEntry = z.infer<typeof entrySchema>;
export type CalendarResult = z.infer<typeof calendarSchema>;

export type CalendarState =
  | { status: "idle" }
  | { status: "success"; result: CalendarResult; productName: string; horizon: string; generationId: string }
  | { status: "error"; message: string };

const HORIZONS: Record<string, string> = {
  "3m": "the next 3 months",
  "6m": "the next 6 months",
  "12m": "the next 12 months",
};

export async function generateMarketingCalendar(
  _prev: CalendarState,
  formData: FormData,
): Promise<CalendarState> {
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

  const brand = readBrandContext(formData, savedInput);
  const brandProfileId = brand.brandProfileId ?? (parent?.brandProfileId ?? null);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");
  const horizonKey = field("horizon") ?? "6m";
  const horizon = HORIZONS[horizonKey] ?? HORIZONS["6m"];
  const market = field("market") ?? "Morocco / MENA";

  // Anchor the plan to today so the model plans forward, not from stale dates.
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    `Primary market: ${market}`,
    `Today's date: ${today}. Plan for ${horizon} starting from today.`,
    `\nBuild a marketing calendar of the seasonal, religious, cultural, and retail moments in this window that this product should plan campaigns around.`,
    `Prioritize moments that genuinely fit this product and market — a skincare brand and a gaming brand should get different calendars.`,
    `For a Morocco/MENA market, weight Islamic-calendar moments heavily (Ramadan, Aïd al-Fitr, Aïd al-Adha, Mawlid), plus local retail moments (back-to-school "la rentrée", summer sales, Black Friday, Yennayer) — but include only what falls inside the horizon.`,
    `Give realistic date windows relative to today's date, and concrete prep lead times.`,
    parent && feedback ? refineDirective(parent.output, feedback) : null,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: calendarSchema,
      system:
        "You are a marketing planner who builds seasonal campaign calendars for consumer brands. " +
        "You know the Islamic lunar calendar shifts ~11 days earlier each Gregorian year and you estimate windows accordingly. " +
        "Every entry must be specific and actionable for the given product — never a generic list of holidays.",
      prompt,
    });

    const generationId = await saveGeneration({
      orgId: org.id,
      tool: "marketing-calendar",
      brandProfileId,
      input: { ...brand.fields, productName, description: field("description"), market, horizon: horizonKey, language, dialect },
      output: object,
      parentId: parent?.id ?? null,
      feedback: parent ? feedback : null,
    });

    return { status: "success", result: object, productName, horizon, generationId: generationId ?? "" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed",
    };
  }
}
