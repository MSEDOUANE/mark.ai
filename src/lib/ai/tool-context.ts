import { db, schema } from "@/db";

/**
 * Shared plumbing for the standalone Generate tools: brand-voice prompt lines
 * from the BrandContextPicker's hidden fields, and persistence of each
 * generation so outputs become reusable assets instead of throwaway screens.
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

/** Best-effort persist — a storage hiccup must never fail the generation. */
export async function saveGeneration(args: {
  orgId: string;
  tool: string;
  brandProfileId: string | null;
  input: Record<string, unknown>;
  output: unknown;
}): Promise<void> {
  try {
    await db.insert(schema.generations).values({
      orgId: args.orgId,
      tool: args.tool,
      brandProfileId: args.brandProfileId,
      input: args.input,
      output: args.output,
    });
  } catch (err) {
    console.error(`[generations] save failed for ${args.tool}:`, err);
  }
}
