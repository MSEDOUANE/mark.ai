/**
 * Shared types for pluggable image generation models.
 *
 * Each model implementation is a single file that exports a `generate` function
 * matching one of these signatures. To swap a model's backend (e.g. fal.ai →
 * Google), edit only that file. To add a new model, create a new file and
 * register it in registry.ts.
 */

export interface TextToImageParams {
  prompt: string;
  apiKey: string;
}

export interface ImageToImageParams {
  /** Raw URL from DB — model implementation handles any conversion needed. */
  imageUrl: string;
  apiKey: string;
}

export interface ComposeParams {
  /** Describes how the reference images should be combined into one scene. */
  prompt: string;
  /** Reference images (e.g. product photo + model photo) — data URLs or http URLs. */
  imageUrls: string[];
  apiKey: string;
  /** Output aspect ratio hint (e.g. "4:5", "1:1", "9:16"). */
  aspectRatio?: string;
}

export interface ImageToVideoParams {
  /** Motion/scene direction for the animation. */
  prompt: string;
  /** Source still to animate — data URL or http URL. */
  imageUrl: string;
  apiKey: string;
  /** Clip length in seconds (model-dependent; usually 5 or 10). */
  durationSeconds?: number;
}

/** Returns the generated image URL on success; throws on failure. */
export type TextToImageFn = (params: TextToImageParams) => Promise<string>;
export type ImageToImageFn = (params: ImageToImageParams) => Promise<string>;
/** Multi-image composition: combines several reference images per a prompt. */
export type ComposeFn = (params: ComposeParams) => Promise<string>;
/** Animates a still into a short clip; returns the video URL. */
export type ImageToVideoFn = (params: ImageToVideoParams) => Promise<string>;
