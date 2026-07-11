/**
 * Image model registry.
 *
 * ── Adding a new text-to-image model ────────────────────────────────────────
 * 1. Create src/lib/creative/image-models/<provider>-<model>.ts
 *    and export a `generate` function matching TextToImageFn.
 * 2. Import it here and add an entry to TEXT_MODELS.
 * 3. Expose the key in the UI (creative-wizard.tsx + creative-card.tsx).
 *
 * ── Switching a model to a different API ────────────────────────────────────
 * Example: move nano-banana-2 from fal.ai to Google's API.
 * 1. Create image-models/google-nano-banana.ts with the new fetch call.
 * 2. Change the import below — nothing else needs to change.
 *
 * ── Switching the img2img model ─────────────────────────────────────────────
 * Change the IMG2IMG_MODEL export to point to a different implementation.
 */

import type { TextToImageFn, ImageToImageFn, ComposeFn } from "./types";

import { generate as falNanoBanana } from "./fal-nano-banana";
import { generate as falNanoBananaEdit } from "./fal-nano-banana-edit";
import { generate as falFluxSchnell } from "./fal-flux-schnell";
import { generate as falFluxRedux } from "./fal-flux-redux";

/** Text-to-image models selectable from the UI via the `imageModel` field. */
export const TEXT_MODELS: Record<string, TextToImageFn> = {
  "nano-banana-2": falNanoBanana,
  "flux-schnell": falFluxSchnell,
};

/** The default model when no imageModel is specified. */
export const DEFAULT_TEXT_MODEL = "nano-banana-2";

/** Image-to-image model used when a product reference photo is available. */
export const IMG2IMG_MODEL: ImageToImageFn = falFluxRedux;

/** Multi-image composition model for "AI Compose" mode (product + model → one scene). */
export const COMPOSE_MODEL: ComposeFn = falNanoBananaEdit;
