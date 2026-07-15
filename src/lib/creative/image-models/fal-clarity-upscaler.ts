/**
 * Image upscaling / enhancement / restoration via fal.ai (Clarity Upscaler).
 *
 * Endpoint: fal-ai/clarity-upscaler
 * One model backs three retouch tools (upscale / enhance / restore) — the
 * caller varies upscaleFactor / creativity / resemblance per preset.
 */

import type { RetouchFn } from "./types";
import { ensureFalReadable } from "./fal-image-util";

export const generate: RetouchFn = async ({
  imageUrl,
  apiKey,
  upscaleFactor = 2,
  creativity = 0.35,
  resemblance = 0.6,
}) => {
  const image_url = await ensureFalReadable(imageUrl);

  const res = await fetch("https://fal.run/fal-ai/clarity-upscaler", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url,
      upscale_factor: upscaleFactor,
      creativity,
      resemblance,
    }),
  });

  if (!res.ok) {
    throw new Error(`clarity-upscaler: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { image?: { url: string } };
  const url = data.image?.url;
  if (!url) throw new Error("clarity-upscaler: no image URL in response");
  return url;
};
