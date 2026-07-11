/**
 * Nano Banana 2 Edit (multi-image composition) via fal.ai.
 *
 * Combines several reference images (e.g. a product photo + a model photo)
 * into a single, integrated scene described by the prompt. This is what powers
 * "AI Compose" mode — the model generates a photoreal shot of the model
 * using/wearing the product, rather than pasting flat cutouts on a background.
 *
 * fal.ai accepts data URIs directly in image_urls, so the base64 uploads from
 * the composer can be passed through unchanged.
 *
 * To switch to a different provider (e.g. Google's API):
 *   1. Duplicate this file
 *   2. Rewrite the fetch call for the new API
 *   3. Update registry.ts to import from the new file
 */

import type { ComposeFn } from "./types";

export const generate: ComposeFn = async ({ prompt, imageUrls, apiKey, aspectRatio }) => {
  const images = imageUrls.filter(Boolean);
  if (images.length === 0) throw new Error("nano-banana-edit: at least one image is required");

  const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: images,
      num_images: 1,
      output_format: "jpeg",
      resolution: "1K",
      aspect_ratio: aspectRatio ?? "auto",
    }),
  });

  if (!res.ok) {
    throw new Error(`nano-banana-edit: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("nano-banana-edit: no image URL in response");
  return url;
};
