/**
 * ImageProvider — model-agnostic CreativeProvider implementation.
 *
 * Routes generation to the right model from the registry:
 *   • imageUrl present → IMG2IMG_MODEL (img2img variation of the product photo)
 *   • no imageUrl      → TEXT_MODELS[imageModel] (text-to-image)
 *
 * Adding support for a completely new API backend (OpenRouter, Google, etc.)
 * requires no changes here — only in image-models/ files and registry.ts.
 */

import type { CreativeJob, CreativeProvider, GenerateCreativeInput } from "./provider";
import { TEXT_MODELS, IMG2IMG_MODEL, COMPOSE_MODEL, VIDEO_MODEL, DEFAULT_TEXT_MODEL } from "./image-models/registry";

export class ImageProvider implements CreativeProvider {
  readonly name = "image";
  private readonly apiKey: string;

  constructor(apiKey = process.env.FAL_KEY ?? "") {
    if (!apiKey) throw new Error("FAL_KEY is required (set it in .env.local)");
    this.apiKey = apiKey;
  }

  async submit(input: GenerateCreativeInput): Promise<CreativeJob> {
    const jobId = crypto.randomUUID();
    try {
      if (input.type === "video") {
        const url = await this.runVideo(input);
        return { providerJobId: jobId, status: "ready", assetUrl: url };
      }

      const refs = input.imageUrls?.filter(Boolean) ?? [];
      const url = refs.length > 0
        ? await this.runCompose(input.prompt, refs, input.aspectRatio)
        : input.imageUrl
        ? await this.runImg2Img(input.imageUrl)
        : await this.runText2Img(input.prompt, input.imageModel);

      return { providerJobId: jobId, status: "ready", assetUrl: url };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[image-provider] generation failed:", error);
      return { providerJobId: jobId, status: "failed", error };
    }
  }

  /**
   * Video creative: animate the supplied source image, or generate the scene
   * still first (text-to-image) and animate that.
   */
  private async runVideo(input: GenerateCreativeInput): Promise<string> {
    const source =
      input.imageUrl ?? (await this.runText2Img(input.prompt, input.imageModel));
    console.log("[image-provider] img2video | source:", source.slice(0, 60));
    return VIDEO_MODEL({
      prompt: input.prompt,
      imageUrl: source,
      apiKey: this.apiKey,
      durationSeconds: input.durationSeconds,
    });
  }

  private async runCompose(prompt: string, imageUrls: string[], aspectRatio?: string): Promise<string> {
    console.log("[image-provider] compose |", imageUrls.length, "refs | prompt:", prompt.slice(0, 80));
    return COMPOSE_MODEL({ prompt, imageUrls, apiKey: this.apiKey, aspectRatio });
  }

  private async runText2Img(prompt: string, modelId?: string): Promise<string> {
    const id = modelId ?? DEFAULT_TEXT_MODEL;
    const fn = TEXT_MODELS[id] ?? TEXT_MODELS[DEFAULT_TEXT_MODEL];
    console.log("[image-provider] text2img:", id, "| prompt:", prompt.slice(0, 80));
    return fn({ prompt, apiKey: this.apiKey });
  }

  private async runImg2Img(imageUrl: string): Promise<string> {
    console.log("[image-provider] img2img | ref:", imageUrl.slice(0, 60));
    return IMG2IMG_MODEL({ imageUrl, apiKey: this.apiKey });
  }

  // All supported models are synchronous — poll is never called.
  async poll(providerJobId: string): Promise<CreativeJob> {
    return { providerJobId, status: "generating" };
  }
}
