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

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
};

/**
 * Arabic dialects — the difference that makes or breaks an Arabic ad. Each
 * carries authentic vocabulary guidance so the AI writes how that audience
 * actually speaks (not generic Fusha). id → UI label + prompt direction.
 * Moroccan Darija is the default, given the primary market.
 */
export const ARABIC_DIALECTS: Array<{
  id: string;
  label: string;
  hint: string;
}> = [
  {
    id: "darija",
    label: "🇲🇦 Moroccan Darija",
    hint:
      "Moroccan Darija (الدارجة المغربية) — the everyday spoken Moroccan dialect, NOT " +
      "Modern Standard Arabic. Use authentic Moroccan words and expressions such as " +
      "بزاف (a lot), دابا (now), واخا (okay), مزيان (good/nice), دروك (right now), " +
      "شحال (how much), ديال (of), خاصك (you need). Warm, casual, exactly how Moroccans " +
      "talk to each other. Write in Arabic script.",
  },
  {
    id: "msa",
    label: "Standard Arabic (فصحى)",
    hint:
      "Modern Standard Arabic (الفصحى) — formal, pan-Arab, polished. Suits premium/" +
      "corporate tone and audiences across all Arab countries.",
  },
  {
    id: "egyptian",
    label: "🇪🇬 Egyptian",
    hint:
      "Egyptian Arabic (المصرية) — the most widely understood dialect across the Arab " +
      "world thanks to media. Use Egyptian vocabulary (e.g. أوي، دلوقتي، عايز، كده).",
  },
  {
    id: "gulf",
    label: "🇸🇦 Gulf / Khaleeji",
    hint:
      "Gulf/Khaleeji Arabic (الخليجية) — for Saudi/UAE/Gulf audiences. Use Gulf " +
      "vocabulary (e.g. وايد، الحين، أبغى، زين).",
  },
  {
    id: "levantine",
    label: "🇱🇧 Levantine",
    hint:
      "Levantine Arabic (الشامية) — Syria/Lebanon/Jordan/Palestine. Use Levantine " +
      "vocabulary (e.g. كتير، هلق، بدي، منيح).",
  },
];

function arabicDirection(dialect?: string | null): string {
  const d = ARABIC_DIALECTS.find((x) => x.id === dialect) ?? ARABIC_DIALECTS[0];
  return d.hint;
}

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
        ? `Voiceover language: ${arabicDirection(input.dialect)} Write ALL voiceover lines natively in this exact dialect — an audience will immediately reject the wrong dialect.`
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
