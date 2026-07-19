import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { generateVideoScript, type VideoScript } from "@/lib/ai/video-script";
import type { VideoScriptInput } from "@/lib/ai/video-script";
import { TEXT_MODELS, DEFAULT_TEXT_MODEL, VIDEO_MODEL } from "@/lib/creative/image-models/registry";
import { ttsGenerate, composeVideo, avatarGenerate, customAvatarGenerate, musicGenerate, AVATARS } from "@/lib/creative/image-models/fal-audio-video";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimToWords(text: string, maxWords: number): string {
  if (maxWords <= 0) return "";
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

/**
 * Kling AI Avatar rejects audio >60s. We keep the CTA and trim body copy to
 * fit a conservative spoken-length budget.
 */
function buildAvatarNarration(script: VideoScript, maxWords: number): string {
  const body = script.scenes.map((s) => s.voiceover).filter(Boolean).join(" ");
  const cta = (script.ctaLine ?? "").trim();
  const full = [body, cta].filter(Boolean).join(" ").trim();
  if (!full) return "";
  if (wordCount(full) <= maxWords) return full;

  const ctaMax = Math.min(16, Math.max(6, maxWords));
  const ctaTrimmed = cta ? trimToWords(cta, ctaMax) : "";
  const ctaWords = wordCount(ctaTrimmed);
  const bodyBudget = Math.max(0, maxWords - ctaWords);
  const bodyTrimmed = trimToWords(body, bodyBudget);
  const combined = [bodyTrimmed, ctaTrimmed].filter(Boolean).join(" ").trim();

  return combined || trimToWords(full, maxWords);
}

/**
 * Video Studio render pipeline. Steps, each memoized so retries don't re-pay:
 *   1. Script (skipped when the project already has one — user edits survive)
 *   2. Per scene: still image (t2i) → clip (i2v). Scenes with an existing
 *      videoUrl are kept — so "regenerate scene 2" only re-renders scene 2.
 *   3. Voiceover: one TTS track from hook + scene lines + CTA.
 *   4. Assembly: ffmpeg compose (clips + voiceover) → finalUrl.
 *
 * Event data: { projectId, resetScenes?: number[] } — resetScenes clears those
 * scenes' assets before rendering (the editor's "regenerate this scene").
 */
export const generateVideoProject = inngest.createFunction(
  {
    id: "generate-video-project",
    name: "Render video project",
    retries: 1,
    triggers: [{ event: "video/render.requested" }],
  },
  async ({ event, step }) => {
    const projectId = event.data.projectId as string;
    const resetScenes = (event.data.resetScenes as number[] | undefined) ?? [];
    const scriptInput =
      (event.data.scriptInput as Partial<VideoScriptInput> | undefined) ?? {};

    const [project] = await db
      .select()
      .from(schema.videoProjects)
      .where(eq(schema.videoProjects.id, projectId))
      .limit(1);
    if (!project) return { skipped: "not found" };

    const apiKey = process.env.FAL_KEY ?? "";
    if (!apiKey) {
      await db
        .update(schema.videoProjects)
        .set({ status: "failed", error: "FAL_KEY is not set", updatedAt: new Date() })
        .where(eq(schema.videoProjects.id, projectId));
      return { failed: "no FAL_KEY" };
    }

    const save = async (patch: Record<string, unknown>) =>
      db
        .update(schema.videoProjects)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.videoProjects.id, projectId));

    try {
      await save({ status: "rendering", error: null });

      // 1. Script — only when missing (edits are authoritative afterwards).
      let script = project.script as VideoScript;
      if (!script?.scenes?.length) {
        const [product] = project.productId
          ? await db
              .select()
              .from(schema.products)
              .where(eq(schema.products.id, project.productId))
              .limit(1)
          : [undefined];
        const [brand] = project.brandProfileId
          ? await db
              .select()
              .from(schema.brandProfiles)
              .where(eq(schema.brandProfiles.id, project.brandProfileId))
              .limit(1)
          : [undefined];

        script = await step.run("script", () =>
          generateVideoScript({
            productName: product?.name ?? project.title,
            productDescription: product?.description,
            audience: product?.targetAudience,
            brandName: brand?.name,
            tone: brand?.tone,
            style: project.style,
            language: project.language,
            dialect: project.dialect,
            objective: scriptInput.objective,
            userPrompt: scriptInput.userPrompt,
            keyPoints: scriptInput.keyPoints,
            callToAction: scriptInput.callToAction,
            mustAvoid: scriptInput.mustAvoid,
            sceneCount: scriptInput.sceneCount,
          }),
        );
        await save({ script });
      }

      // Avatar style: one lip-synced talking-creator video speaks the whole
      // script — no per-scene filming, no assembly.
      if (project.style === "avatar") {
        const spoken = [
          ...script.scenes.map((s) => s.voiceover),
          script.ctaLine,
        ]
          .filter(Boolean)
          .join(" ");

        let finalUrl: string;
        if (project.avatarImageUrl) {
          // Bring-your-own avatar: voice the script (any language incl.
          // Arabic), then drive the user's photo with Kling AI Avatar.
          // 60s audio cap ≈ ~130 spoken words with margin.
          const narration = buildAvatarNarration(script, 130);
          const audioUrl = await step.run("avatar-voice", () =>
            ttsGenerate({
              text: narration,
              language: project.language,
              voice: project.voice,
              apiKey,
            }),
          );
          try {
            finalUrl = await step.run("avatar-custom", () =>
              customAvatarGenerate({
                imageUrl: project.avatarImageUrl!,
                audioUrl,
                apiKey,
              }),
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // Provider error strings vary ("audio_duration_too_long",
            // "audio duration exceeds..."); match loosely on audio+length.
            if (!/audio.{0,40}(duration|too.?long|exceed)/i.test(msg)) throw err;

            const shorterNarration = buildAvatarNarration(script, 70);
            const shortAudioUrl = await step.run("avatar-voice-short", () =>
              ttsGenerate({
                text: shorterNarration,
                language: project.language,
                voice: project.voice,
                apiKey,
              }),
            );
            finalUrl = await step.run("avatar-custom-short", () =>
              customAvatarGenerate({
                imageUrl: project.avatarImageUrl!,
                audioUrl: shortAudioUrl,
                apiKey,
              }),
            );
          }
        } else {
          // Preset VEED avatar (voice baked in by the model).
          finalUrl = await step.run("avatar", () =>
            avatarGenerate({
              text: spoken,
              avatarId: project.avatar ?? AVATARS[0].id,
              apiKey,
            }),
          );
        }

        await save({ status: "ready", finalUrl, script });
        return { projectId, status: "ready", style: "avatar" };
      }

      // Clear assets for scenes the user asked to regenerate.
      if (resetScenes.length) {
        for (const i of resetScenes) {
          const s = script.scenes[i];
          if (s) {
            s.imageUrl = null;
            s.videoUrl = null;
          }
        }
        await save({ script });
      }

      // 2. Scenes: still → clip (skip scenes that already have a clip).
      const t2i = TEXT_MODELS[DEFAULT_TEXT_MODEL];
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        if (scene.videoUrl) continue;

        const imageUrl = await step.run(`scene-${i}-image`, () =>
          scene.imageUrl
            ? Promise.resolve(scene.imageUrl)
            : t2i({ prompt: scene.visual, apiKey }),
        );
        scene.imageUrl = imageUrl;
        await save({ script });

        const videoUrl = await step.run(`scene-${i}-video`, () =>
          VIDEO_MODEL({
            prompt: scene.motion || scene.visual,
            imageUrl: imageUrl!,
            apiKey,
            durationSeconds: scene.durationSeconds === 10 ? 10 : 5,
          }),
        );
        scene.videoUrl = videoUrl;
        await save({ script });
      }

      // 3. Voiceover — one continuous track reads naturally across scenes.
      const voiceoverText = [
        ...script.scenes.map((s) => s.voiceover),
        script.ctaLine,
      ]
        .filter(Boolean)
        .join(" ... ");
      const audioUrl = await step.run("voiceover", () =>
        ttsGenerate({
          text: voiceoverText,
          language: project.language,
          voice: project.voice,
          apiKey,
        }),
      );

      // 3b. Optional background music bed (stable-audio, capped at 47s).
      let musicUrl: string | null = null;
      if (project.musicPrompt) {
        const totalSeconds = script.scenes.reduce(
          (sum, s) => sum + (s.durationSeconds === 10 ? 10 : 5),
          0,
        );
        musicUrl = await step.run("music", () =>
          musicGenerate({
            prompt: project.musicPrompt!,
            durationSeconds: Math.min(totalSeconds, 47),
            apiKey,
          }),
        );
      }

      // 4. Assembly.
      const finalUrl = await step.run("compose", () =>
        composeVideo({
          scenes: script.scenes.map((s) => ({
            url: s.videoUrl!,
            durationSeconds: s.durationSeconds === 10 ? 10 : 5,
          })),
          audioUrl,
          musicUrl,
          apiKey,
        }),
      );

      await save({ status: "ready", finalUrl, script });
      return { projectId, status: "ready" };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 400) : String(err);
      console.error("[video-project] render failed:", message);
      await save({ status: "failed", error: message });
      return { projectId, status: "failed", error: message };
    }
  },
);
