/**
 * Audio + assembly models for the Video Studio, all on fal.ai:
 *   • ttsGenerate  — Kokoro TTS (per-language endpoints) → voiceover audio URL
 *   • composeVideo — fal ffmpeg compose: scene clips + voiceover → final mp4
 *
 * Endpoint ids are pinned here so a model swap is a one-line change.
 */

const TTS_ENDPOINTS: Record<string, string> = {
  en: "fal-ai/kokoro/american-english",
  fr: "fal-ai/kokoro/french",
};

/** Voice presets per language (Kokoro voice ids). */
export const TTS_VOICES: Record<string, Record<string, string>> = {
  en: { female: "af_heart", male: "am_michael" },
  fr: { female: "ff_siwis", male: "ff_siwis" },
};

export async function ttsGenerate(args: {
  text: string;
  language: string;
  voice: string; // "female" | "male"
  apiKey: string;
}): Promise<string> {
  const endpoint = TTS_ENDPOINTS[args.language] ?? TTS_ENDPOINTS.en;
  const voiceId =
    TTS_VOICES[args.language]?.[args.voice] ?? TTS_VOICES.en.female;

  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: args.text, voice: voiceId }),
  });
  if (!res.ok) {
    throw new Error(`tts: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { audio?: { url?: string } };
  if (!data.audio?.url) throw new Error("tts: no audio URL in response");
  return data.audio.url;
}

interface ComposeKeyframe {
  url: string;
  timestamp: number; // ms
  duration: number; // ms
}

/**
 * Concatenate scene clips and lay the voiceover under them.
 * Uses the queue API — assembly of several clips takes a while.
 */
export async function composeVideo(args: {
  scenes: Array<{ url: string; durationSeconds: number }>;
  audioUrl?: string | null;
  apiKey: string;
}): Promise<string> {
  let t = 0;
  const videoKeyframes: ComposeKeyframe[] = args.scenes.map((s) => {
    const kf = { url: s.url, timestamp: t, duration: s.durationSeconds * 1000 };
    t += s.durationSeconds * 1000;
    return kf;
  });

  const tracks: Array<Record<string, unknown>> = [
    { id: "scenes", type: "video", keyframes: videoKeyframes },
  ];
  if (args.audioUrl) {
    tracks.push({
      id: "voiceover",
      type: "audio",
      keyframes: [{ url: args.audioUrl, timestamp: 0, duration: t }],
    });
  }

  const headers = {
    Authorization: `Key ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  const submit = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/compose", {
    method: "POST",
    headers,
    body: JSON.stringify({ tracks }),
  });
  if (!submit.ok) {
    throw new Error(
      `compose submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`,
    );
  }
  const job = (await submit.json()) as {
    status_url?: string;
    response_url?: string;
  };
  if (!job.status_url || !job.response_url) {
    throw new Error("compose: queue response missing status/response URLs");
  }

  const deadline = Date.now() + 6 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("compose: timed out");
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(job.status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`compose: ${s.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(
      `compose result: ${result.status} ${(await result.text()).slice(0, 200)}`,
    );
  }
  const data = (await result.json()) as { video_url?: string };
  if (!data.video_url) throw new Error("compose: no video_url in response");
  return data.video_url;
}
