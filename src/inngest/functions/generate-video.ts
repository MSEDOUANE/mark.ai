import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { generateVideoScript, type VideoScript } from "@/lib/ai/video-script";
import { TEXT_MODELS, DEFAULT_TEXT_MODEL, VIDEO_MODEL } from "@/lib/creative/image-models/registry";
import { ttsGenerate, composeVideo } from "@/lib/creative/image-models/fal-audio-video";

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
          }),
        );
        await save({ script });
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

      // 4. Assembly.
      const finalUrl = await step.run("compose", () =>
        composeVideo({
          scenes: script.scenes.map((s) => ({
            url: s.videoUrl!,
            durationSeconds: s.durationSeconds === 10 ? 10 : 5,
          })),
          audioUrl,
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
