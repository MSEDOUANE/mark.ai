import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "./models";
import { ARABIC_DIALECTS, arabicDialectHint } from "./languages";

// Re-exported for existing importers (videos/page.tsx, videos/[id]/page.tsx).
export { ARABIC_DIALECTS };

/**
 * Video Studio script — the editable heart of a video project. The AI writes
 * it scene by scene; the editor lets the user adjust any field; the render
 * pipeline turns each scene into a clip (visual prompt → image → video) plus
 * a TTS voiceover line, then assembles them.
 */

export const sceneSchema = z.object({
  /** What the viewer SEES — a concrete text-to-image prompt for this scene. */
  visual: z
    .string()
    .describe(
      "Concrete visual scene prompt (30-60 words): setting, subject, lighting, camera feel. No text in image.",
    ),
  /** Camera/motion direction for animating the scene still. */
  motion: z
    .string()
    .describe("One sentence of camera/subject motion for the animation, e.g. 'slow push-in, hands turn the product'"),
  /** What the viewer HEARS — the voiceover line for this scene. */
  voiceover: z
    .string()
    .describe("Spoken line for this scene, natural and conversational, ≤25 words"),
  durationSeconds: z
    .number()
    .int()
    .describe("Scene length: 5 or 10 seconds")
    .default(5),
});

export const videoScriptSchema = z.object({
  hook: z.string().describe("The first-second hook line that stops the scroll"),
  scenes: z.array(sceneSchema).min(2).max(5),
  ctaLine: z.string().describe("Closing call-to-action voiceover line, ≤12 words"),
});

export type VideoScene = z.infer<typeof sceneSchema> & {
  /** Filled by the render pipeline. */
  imageUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
};

export type VideoScript = {
  hook: string;
  ctaLine: string;
  scenes: VideoScene[];
};

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
};

const STYLE_DIRECTION: Record<string, string> = {
  avatar:
    "UGC creator monologue spoken to camera in ONE continuous take by a lip-synced " +
    "avatar. The voiceover lines ARE the entire ad — they must flow naturally as one " +
    "speech (no scene jumps), conversational and enthusiastic first-person. Visual/" +
    "motion fields are ignored for this style; keep them minimal.",
  ugc:
    "UGC (user-generated-content) ad: authentic selfie/handheld feel, a real person's " +
    "perspective, casual and enthusiastic first-person voiceover ('I found…', 'you NEED " +
    "this'), natural imperfect settings (bedroom, car, street), phone-camera aesthetic.",
  storytelling:
    "Narrative mini-story arc: problem → discovery → transformation. Cinematic visuals, " +
    "emotional voiceover in second person, each scene advances the story.",
  showcase:
    "Premium product showcase: studio/editorial visuals, macro details, elegant motion, " +
    "confident brand voiceover focused on craft and benefits.",
};

export interface VideoScriptInput {
  productName: string;
  productDescription?: string | null;
  audience?: string | null;
  brandName?: string | null;
  tone?: string | null;
  style: string;
  /** Voiceover language: "en" | "fr" | "ar". */
  language: string;
  /** Arabic dialect id (only used when language === "ar"). */
  dialect?: string | null;
  /** Business objective for the ad, e.g. leads or sales. */
  objective?: string | null;
  /** Free-form user direction to guide script/style choices. */
  userPrompt?: string | null;
  /** Non-negotiable points the script should cover. */
  keyPoints?: string | null;
  /** Preferred CTA phrasing or action. */
  callToAction?: string | null;
  /** Claims, visuals, or wording to avoid. */
  mustAvoid?: string | null;
  sceneCount?: number;
}

/** Context for a feedback-driven revision — enough to keep voice/dialect/style right. */
export interface ReviseVideoScriptInput {
  current: VideoScript;
  feedback: string;
  style: string;
  language: string;
  dialect?: string | null;
  brandName?: string | null;
  tone?: string | null;
}

/**
 * Revise an existing video script from free-text user feedback. Returns a new
 * VideoScript (asset URLs intentionally dropped — a revised script re-renders
 * from scratch). Keeps whatever already works and changes only what the
 * feedback asks for, preserving language/dialect and (unless the feedback says
 * otherwise) the scene count.
 */
export async function reviseVideoScript(
  input: ReviseVideoScriptInput,
): Promise<VideoScript> {
  // Strip render artifacts so the model sees just the authored script.
  const cleanScript = {
    hook: input.current.hook,
    scenes: (input.current.scenes ?? []).map((s) => ({
      visual: s.visual,
      motion: s.motion,
      voiceover: s.voiceover,
      durationSeconds: s.durationSeconds,
    })),
    ctaLine: input.current.ctaLine,
  };
  const sceneCount = cleanScript.scenes.length || 3;

  const { object } = await generateObject({
    model: strategistModel,
    schema: videoScriptSchema,
    system:
      "You revise short-form video ad scripts (15-30s) for Meta/TikTok from a " +
      "user's feedback. Scene visuals must stay concrete and filmable as single " +
      "shots; voiceover must read aloud naturally in the SAME language/dialect as " +
      "the current script and fit the scene duration (~2.5 words/second). Never " +
      "invent prices or discounts.",
    prompt: [
      `Style: ${STYLE_DIRECTION[input.style] ?? STYLE_DIRECTION.ugc}`,
      input.language === "ar"
        ? `Voiceover language: ${arabicDialectHint(input.dialect)} Keep ALL voiceover lines natively in this exact dialect.`
        : `Voiceover language: ${LANGUAGE_LABEL[input.language] ?? "English"} (keep ALL voiceover lines natively in it)`,
      input.brandName ? `Brand: ${input.brandName}` : null,
      input.tone ? `Brand voice: ${input.tone}` : null,
      `\nCurrent script:\n${JSON.stringify(cleanScript, null, 2)}`,
      `\nThe user reviewed this video and gave the following feedback — apply it specifically:\n"${input.feedback}"`,
      "\nRewrite the script fully incorporating the feedback. Keep whatever already " +
        `works; change only what the feedback asks for. Keep ${sceneCount} scenes ` +
        "unless the feedback explicitly asks to add or remove scenes. The first " +
        "scene's voiceover IS the hook.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return object;
}

export async function generateVideoScript(
  input: VideoScriptInput,
): Promise<VideoScript> {
  const { object } = await generateObject({
    model: strategistModel,
    schema: videoScriptSchema,
    system:
      "You write short-form video ad scripts (15-30s total) for Meta/TikTok. " +
      "Scene visuals must be concrete and filmable as single shots. Voiceover " +
      "must read aloud naturally in the requested language and fit the scene " +
      "duration (~2.5 words/second). Never invent prices or discounts.",
    prompt: [
      `Style: ${STYLE_DIRECTION[input.style] ?? STYLE_DIRECTION.ugc}`,
      input.language === "ar"
        ? `Voiceover language: ${arabicDialectHint(input.dialect)} Write ALL voiceover lines natively in this exact dialect — an audience will immediately reject the wrong dialect.`
        : `Voiceover language: ${LANGUAGE_LABEL[input.language] ?? "English"} (write ALL voiceover lines natively in it)`,
      input.brandName ? `Brand: ${input.brandName}` : null,
      input.tone ? `Brand voice: ${input.tone}` : null,
      `Product: ${input.productName}`,
      input.productDescription ? `Description: ${input.productDescription}` : null,
      input.audience ? `Audience: ${input.audience}` : null,
      input.objective ? `Objective: ${input.objective}` : null,
      input.userPrompt ? `User direction: ${input.userPrompt}` : null,
      input.keyPoints ? `Key points to include: ${input.keyPoints}` : null,
      input.callToAction ? `CTA preference: ${input.callToAction}` : null,
      input.mustAvoid ? `Avoid: ${input.mustAvoid}` : null,
      `Write ${input.sceneCount ?? 3} scenes. The first scene's voiceover IS the hook.`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return object;
}
