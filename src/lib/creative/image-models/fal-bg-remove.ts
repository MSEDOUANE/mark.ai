/**
 * Background removal via fal.ai (Bria RMBG 2.0).
 *
 * Endpoint: fal-ai/bria/background/remove
 * To switch providers, rewrite the fetch call and update retouch-tools.ts.
 */

import type { RetouchFn } from "./types";
import { ensureFalReadable } from "./fal-image-util";

export const generate: RetouchFn = async ({ imageUrl, apiKey }) => {
  const image_url = await ensureFalReadable(imageUrl);

  const res = await fetch("https://fal.run/fal-ai/bria/background/remove", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url }),
  });

  if (!res.ok) {
    throw new Error(`bg-remove: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { image?: { url: string } };
  const url = data.image?.url;
  if (!url) throw new Error("bg-remove: no image URL in response");
  return url;
};
