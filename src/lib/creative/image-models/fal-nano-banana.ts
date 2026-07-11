/**
 * Nano Banana 2 via fal.ai
 *
 * To switch this to Google's API or another provider:
 *   1. Duplicate this file (e.g. google-nano-banana.ts)
 *   2. Rewrite the fetch call for the new API
 *   3. Update registry.ts to import from the new file
 */

import type { TextToImageFn } from "./types";

export const generate: TextToImageFn = async ({ prompt, apiKey }) => {
  const res = await fetch("https://fal.run/fal-ai/nano-banana-2", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      output_format: "jpeg",
      resolution: "1K",
      aspect_ratio: "auto",
    }),
  });

  if (!res.ok) {
    throw new Error(`nano-banana-2: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("nano-banana-2: no image URL in response");
  return url;
};
