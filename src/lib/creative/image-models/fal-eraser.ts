/**
 * Object removal / cleanup via fal.ai (Bria Eraser).
 *
 * Endpoint: fal-ai/bria/eraser
 * Requires a mask where white marks the pixels to erase.
 */

import type { RetouchFn } from "./types";
import { ensureFalReadable } from "./fal-image-util";

export const generate: RetouchFn = async ({ imageUrl, maskUrl, apiKey }) => {
  if (!maskUrl) throw new Error("eraser: a mask is required");

  const image_url = await ensureFalReadable(imageUrl);
  const mask_url = await ensureFalReadable(maskUrl);

  const res = await fetch("https://fal.run/fal-ai/bria/eraser", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url, mask_url }),
  });

  if (!res.ok) {
    throw new Error(`eraser: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { image?: { url: string } };
  const url = data.image?.url;
  if (!url) throw new Error("eraser: no image URL in response");
  return url;
};
