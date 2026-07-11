/**
 * FLUX Schnell Redux (image-to-image variation) via fal.ai.
 *
 * fal.ai cannot download external URLs blocked by bot-protection, so any URL
 * that isn't already on fal's own CDN is fetched server-side and re-sent as a
 * base64 data URL. This conversion is fal.ai-specific; a different provider
 * implementation would remove or replace it.
 *
 * To switch to a different img2img provider:
 *   1. Duplicate this file
 *   2. Rewrite the fetch call (and remove the base64 conversion if not needed)
 *   3. Update registry.ts to import from the new file
 */

import type { ImageToImageFn } from "./types";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export const generate: ImageToImageFn = async ({ imageUrl, apiKey }) => {
  // fal.ai can access its own CDN directly; everything else must be base64-encoded.
  const isFalCdn =
    imageUrl.startsWith("data:") ||
    imageUrl.includes("fal.media") ||
    imageUrl.includes("fal.ai");

  let imageInput = imageUrl;
  if (!isFalCdn) {
    const encoded = await toDataUrl(imageUrl);
    if (!encoded) throw new Error("flux-redux: could not fetch reference image");
    imageInput = encoded;
  }

  const res = await fetch("https://fal.run/fal-ai/flux/schnell/redux", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageInput,
      image_size: "square",
      num_inference_steps: 4,
      num_images: 1,
      output_format: "jpeg",
    }),
  });

  if (!res.ok) {
    throw new Error(`flux-redux: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("flux-redux: no image URL in response");
  return url;
};
