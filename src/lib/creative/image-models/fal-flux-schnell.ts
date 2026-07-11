/**
 * FLUX Schnell (text-to-image) via fal.ai — fast, low cost.
 *
 * To switch to a different provider for this model:
 *   1. Duplicate this file
 *   2. Rewrite the fetch call
 *   3. Update registry.ts
 */

import type { TextToImageFn } from "./types";

export const generate: TextToImageFn = async ({ prompt, apiKey }) => {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "square",
      num_inference_steps: 4,
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`flux-schnell: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("flux-schnell: no image URL in response");
  return url;
};
