"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { strategistModel } from "@/lib/ai/models";

const voiceNotesSchema = z.object({
  voiceNotes: z.string().describe(
    "2-4 sentences capturing this brand's consistent voice: vocabulary patterns, sentence " +
    "rhythm, recurring themes/angles, and what to avoid — written as direction for a copywriter.",
  ),
});

export type BrandLearningState =
  | { status: "idle" }
  | { status: "success"; draft: string }
  | { status: "error"; message: string };

/**
 * Brand Learning: Claude reads this brand's recent Generate-tool outputs
 * (ad copy, captions, descriptions, etc.) and drafts a voiceNotes summary.
 * Returns a draft only — the user reviews and explicitly saves it via the
 * normal brand form, nothing is written here.
 */
export async function proposeBrandVoiceNotes(
  _prev: BrandLearningState,
  formData: FormData,
): Promise<BrandLearningState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const brandProfileId = String(formData.get("brandProfileId") ?? "").trim();
  if (!brandProfileId) return { status: "error", message: "Missing brand." };

  const [brand] = await db
    .select({ id: schema.brandProfiles.id, name: schema.brandProfiles.name, tone: schema.brandProfiles.tone })
    .from(schema.brandProfiles)
    .where(and(eq(schema.brandProfiles.id, brandProfileId), eq(schema.brandProfiles.orgId, org.id)))
    .limit(1);
  if (!brand) return { status: "error", message: "Brand not found." };

  const generations = await db
    .select({ tool: schema.generations.tool, output: schema.generations.output })
    .from(schema.generations)
    .where(and(eq(schema.generations.brandProfileId, brandProfileId), eq(schema.generations.orgId, org.id)))
    .orderBy(desc(schema.generations.createdAt))
    .limit(15);

  if (generations.length === 0) {
    return {
      status: "error",
      message: "No generated content for this brand yet — use it in Ad Copy, Captions, or Personas first, then come back.",
    };
  }

  const samples = generations
    .map((g, i) => `[${i + 1}] (${g.tool}): ${JSON.stringify(g.output).slice(0, 500)}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: voiceNotesSchema,
      system:
        "You are a brand voice analyst. Read past AI-generated marketing copy for this brand and " +
        "extract the CONSISTENT patterns — not a description of any single piece, but what recurs " +
        "across all of them. Write it as terse direction a copywriter could follow immediately.",
      prompt: [
        `Brand: ${brand.name}`,
        brand.tone && `Declared tone: ${brand.tone}`,
        `\nPast generated content (${generations.length} samples):`,
        samples,
      ].filter(Boolean).join("\n"),
    });
    return { status: "success", draft: object.voiceNotes };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Analysis failed",
    };
  }
}
