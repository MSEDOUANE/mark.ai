/**
 * Kling 2.6 Pro image-to-video via fal.ai — animates a still ad scene into a
 * ~5s clip. Upgraded from 2.1 standard ($0.05/s) to 2.6 Pro ($0.07/s) for a
 * large motion/detail quality jump at +$0.10 per 5s scene. Native audio is
 * explicitly DISABLED — it doubles the price to $0.14/s and the pipeline lays
 * its own voiceover/music in the compose step anyway.
 *
 * Video generation takes minutes, so this uses fal's QUEUE API (submit →
 * poll status_url → fetch response_url) instead of the synchronous fal.run
 * endpoint the image models use. The call blocks until done — it runs inside
 * an Inngest step, which tolerates long execution.
 */

import type { ImageToVideoFn } from "./types";

const SUBMIT_URL =
  "https://queue.fal.run/fal-ai/kling-video/v2.6/pro/image-to-video";
const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 8 * 60_000;

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

export const generate: ImageToVideoFn = async ({
  prompt,
  imageUrl,
  apiKey,
  durationSeconds,
}) => {
  // fal can read its own CDN; anything else goes in as base64.
  const isFalReachable =
    imageUrl.startsWith("data:") ||
    imageUrl.includes("fal.media") ||
    imageUrl.includes("fal.ai");
  let imageInput = imageUrl;
  if (!isFalReachable) {
    const encoded = await toDataUrl(imageUrl);
    if (!encoded) throw new Error("kling-video: could not fetch source image");
    imageInput = encoded;
  }

  const headers = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  const submit = await fetch(SUBMIT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt:
        prompt ||
        "Subtle cinematic motion: gentle camera push-in, soft ambient movement, product stays sharp and centered.",
      start_image_url: imageInput,
      duration: String(durationSeconds === 10 ? 10 : 5),
      generate_audio: false,
    }),
  });
  if (!submit.ok) {
    throw new Error(
      `kling-video submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`,
    );
  }
  const job = (await submit.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };
  if (!job.status_url || !job.response_url) {
    throw new Error("kling-video: queue response missing status/response URLs");
  }

  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error("kling-video: timed out");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(job.status_url, { headers });
    if (!statusRes.ok) continue; // transient — keep polling until deadline
    const status = (await statusRes.json()) as { status?: string };
    if (status.status === "COMPLETED") break;
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`kling-video: generation ${status.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(
      `kling-video result: ${result.status} ${(await result.text()).slice(0, 200)}`,
    );
  }
  const data = (await result.json()) as { video?: { url?: string } };
  if (!data.video?.url) throw new Error("kling-video: no video URL in response");
  return data.video.url;
};
