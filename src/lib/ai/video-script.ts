import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "./models";

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
  /** Voiceover language: "en" | "fr". */
  language: string;
  sceneCount?: number;
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
      `Voiceover language: ${input.language === "fr" ? "French" : "English"} (write ALL voiceover lines in it)`,
      input.brandName ? `Brand: ${input.brandName}` : null,
      input.tone ? `Brand voice: ${input.tone}` : null,
      `Product: ${input.productName}`,
      input.productDescription ? `Description: ${input.productDescription}` : null,
      input.audience ? `Audience: ${input.audience}` : null,
      `Write ${input.sceneCount ?? 3} scenes. The first scene's voiceover IS the hook.`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return object;
}
