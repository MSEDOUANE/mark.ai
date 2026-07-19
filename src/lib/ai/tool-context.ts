import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Shared plumbing for the standalone Generate tools: brand-voice prompt lines
 * from the BrandContextPicker's hidden fields, and persistence of each
 * generation so outputs become reusable assets instead of throwaway screens.
 *
 * Refine-with-feedback: every tool's `generations` row can carry a `parentId`
 * pointing at the generation it refines, plus the `feedback` that drove the
 * refinement. A tool's action reads `refineGenerationId`/`refineFeedback`
 * from the form (see `loadRefineParent` + `refineDirective` below), falls
 * back to the parent's stored `input` for any field the refine form didn't
 * resubmit (see each tool's `field()` helper), and saves the new row with
 * `parentId` set — so the chain IS the "conversation" history.
 */

export interface BrandContext {
  brandProfileId: string | null;
  lines: string[];
}

export function readBrandContext(formData: FormData): BrandContext {
  const get = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const name = get("brandName");
  const tone = get("brandTone");
  const description = get("brandDescription");
  const voiceNotes = get("brandVoiceNotes");
  return {
    brandProfileId: get("brandProfileId"),
    lines: [
      name ? `Brand: ${name}` : null,
      tone ? `Brand voice (write everything in this voice): ${tone}` : null,
      description ? `Brand context: ${description}` : null,
      voiceNotes ? `Consistency notes from past content (follow these patterns): ${voiceNotes}` : null,
    ].filter((l): l is string => !!l),
  };
}

/**
 * Best-effort persist — a storage hiccup must never fail the generation.
 * Returns the new row's id (needed to keep refining this generation further),
 * or null if the save itself failed.
 */
export async function saveGeneration(args: {
  orgId: string;
  tool: string;
  brandProfileId: string | null;
  input: Record<string, unknown>;
  output: unknown;
  parentId?: string | null;
  feedback?: string | null;
}): Promise<string | null> {
  try {
    const [row] = await db
      .insert(schema.generations)
      .values({
        orgId: args.orgId,
        tool: args.tool,
        brandProfileId: args.brandProfileId,
        input: args.input,
        output: args.output,
        parentId: args.parentId ?? null,
        feedback: args.feedback ?? null,
      })
      .returning({ id: schema.generations.id });
    return row?.id ?? null;
  } catch (err) {
    console.error(`[generations] save failed for ${args.tool}:`, err);
    return null;
  }
}

/**
 * Loads the parent generation for a refine round, scoped to the org (so one
 * org can never refine off another's generation). Returns null when the form
 * carries no `refineGenerationId` (a fresh, non-refined generation) or the
 * row isn't found/owned.
 */
export async function loadRefineParent(
  formData: FormData,
  orgId: string,
): Promise<typeof schema.generations.$inferSelect | null> {
  const id = String(formData.get("refineGenerationId") ?? "").trim();
  if (!id) return null;
  const [row] = await db
    .select()
    .from(schema.generations)
    .where(and(eq(schema.generations.id, id), eq(schema.generations.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** The feedback text for a refine round, or null when this isn't one. */
export function readRefineFeedback(formData: FormData): string | null {
  const v = String(formData.get("refineFeedback") ?? "").trim();
  return v || null;
}

/**
 * Appended to a tool's prompt on a refine round: the previous output plus the
 * user's feedback, with an explicit instruction to act on it rather than
 * lightly restate the old result.
 */
export function refineDirective(previousOutput: unknown, feedback: string): string {
  return [
    "\n--- REFINEMENT ROUND ---",
    `Previous version:\n${JSON.stringify(previousOutput, null, 2)}`,
    `\nThe user reviewed this and gave the following feedback — apply it specifically:\n"${feedback}"`,
    "\nRewrite fully incorporating the feedback above. Keep whatever already works; " +
      "change only what the feedback is asking for. Do not ignore or water down the feedback.",
  ].join("\n");
}
