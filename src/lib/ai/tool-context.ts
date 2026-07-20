import { and, desc, eq } from "drizzle-orm";
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
  /**
   * The raw brand fields, to spread into a generation's saved `input`. A
   * refine round's form doesn't carry the BrandContextPicker's hidden fields
   * (it's a separate <form>), so without persisting these the refined output
   * would silently lose the brand voice the original round had.
   */
  fields: {
    brandProfileId: string | null;
    brandName: string | null;
    brandTone: string | null;
    brandDescription: string | null;
    brandVoiceNotes: string | null;
  };
}

export function readBrandContext(
  formData: FormData,
  /** A refine parent's stored `input` — fallback when the form lacks the
   *  picker's fields (see BrandContext.fields). */
  savedInput?: Record<string, unknown>,
): BrandContext {
  const get = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    if (v) return v;
    const saved = savedInput?.[k];
    return typeof saved === "string" && saved ? saved : null;
  };
  const name = get("brandName");
  const tone = get("brandTone");
  const description = get("brandDescription");
  const voiceNotes = get("brandVoiceNotes");
  const brandProfileId = get("brandProfileId");
  return {
    brandProfileId,
    lines: [
      name ? `Brand: ${name}` : null,
      tone ? `Brand voice (write everything in this voice): ${tone}` : null,
      description ? `Brand context: ${description}` : null,
      voiceNotes ? `Consistency notes from past content (follow these patterns): ${voiceNotes}` : null,
    ].filter((l): l is string => !!l),
    fields: {
      brandProfileId,
      brandName: name,
      brandTone: tone,
      brandDescription: description,
      brandVoiceNotes: voiceNotes,
    },
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

/**
 * Human-readable labels per `generations.tool` string. The tool strings are
 * historical / not 1:1 with route segments (e.g. "marketing-calendar" is
 * served at /dashboard/generate/calendar), so this map is the single source
 * of truth for displaying a stored generation's origin. Keep in sync with the
 * tools that call saveGeneration.
 */
export const GENERATION_TOOL_LABELS: Record<string, string> = {
  "ad-copy": "Ad Copy",
  "product-description": "Product Description",
  "marketing-copy": "Marketing Copy",
  "social-captions": "Social Captions",
  personas: "Buyer Personas",
  "audience-insights": "Audience Insights",
  "marketing-calendar": "Marketing Calendar",
  "brand-safety": "Brand Safety Check",
  "funnel-design": "Funnel Designer",
  "email-marketing": "Email Marketing",
  "content-planner": "Content Planner",
};

/**
 * Walks a generation's ancestry (via `parentId`) from the given row up to its
 * root original, org-scoped, and returns the chain oldest-first (root →
 * target). This IS the persisted "conversation" for that version — read from
 * the DB, so it survives page reloads (unlike the client-side round log in
 * the live tool view). Depth-capped and cycle-guarded against bad data.
 * Returns [] if the target isn't found or isn't owned by the org.
 */
export async function loadGenerationThread(
  id: string,
  orgId: string,
): Promise<Array<typeof schema.generations.$inferSelect>> {
  const chain: Array<typeof schema.generations.$inferSelect> = [];
  const seen = new Set<string>();
  let currentId: string | null = id;

  for (let i = 0; i < 50 && currentId && !seen.has(currentId); i++) {
    seen.add(currentId);
    const [row] = await db
      .select()
      .from(schema.generations)
      .where(and(eq(schema.generations.id, currentId), eq(schema.generations.orgId, orgId)))
      .limit(1);
    if (!row) break;
    chain.push(row);
    currentId = row.parentId;
  }

  return chain.reverse(); // root → target
}

/**
 * The id of the most recent DIRECT child (later refinement) of a generation,
 * or null if it's a leaf. Lets the thread page detect when the user opened a
 * mid-chain version — so it can label honestly ("a newer version exists")
 * and offer a forward link, rather than falsely claiming to be the latest.
 * Org-scoped.
 */
export async function loadNewerVersion(
  id: string,
  orgId: string,
): Promise<string | null> {
  const [child] = await db
    .select({ id: schema.generations.id })
    .from(schema.generations)
    .where(and(eq(schema.generations.parentId, id), eq(schema.generations.orgId, orgId)))
    .orderBy(desc(schema.generations.createdAt))
    .limit(1);
  return child?.id ?? null;
}
