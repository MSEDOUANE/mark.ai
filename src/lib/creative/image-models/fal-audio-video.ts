/**
 * Audio + assembly models for the Video Studio, all on fal.ai:
 *   • ttsGenerate     — voiceover audio URL. Kokoro for en/fr; ElevenLabs
 *                       multilingual-v2 for ar (Kokoro has no Arabic).
 *   • musicGenerate   — fal-ai/stable-audio: text prompt → background music
 *   • sfxGenerate     — fal-ai/elevenlabs/sound-effects/v2: text → one-shot SFX
 *   • composeVideo    — fal ffmpeg compose: scene clips + voiceover → final mp4
 *   • avatarGenerate  — VEED preset talking avatars: script → lip-synced video
 *   • omnihumanGenerate — ByteDance OmniHuman: user's OWN photo + audio →
 *                       realistic talking-head video (bring-your-own avatar)
 *
 * Endpoint ids are pinned here so a model swap is a one-line change.
 */

/** Languages offered in the studio. Arabic routes through ElevenLabs. */
export const VOICE_LANGUAGES: Array<{ id: string; label: string }> = [
  { id: "ar", label: "العربية (Arabic)" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const KOKORO_ENDPOINTS: Record<string, string> = {
  en: "fal-ai/kokoro/american-english",
  fr: "fal-ai/kokoro/french",
};

/** Kokoro voice ids per language (en/fr). */
const KOKORO_VOICES: Record<string, Record<string, string>> = {
  en: { female: "af_heart", male: "am_michael" },
  fr: { female: "ff_siwis", male: "ff_siwis" },
};

/** ElevenLabs multilingual voice names (speak any language incl. Arabic). */
const ELEVEN_VOICES: Record<string, string> = {
  female: "Rachel",
  male: "Brian",
};

async function kokoroTts(args: {
  text: string;
  language: string;
  voice: string;
  apiKey: string;
}): Promise<string> {
  const endpoint = KOKORO_ENDPOINTS[args.language] ?? KOKORO_ENDPOINTS.en;
  const voiceId =
    KOKORO_VOICES[args.language]?.[args.voice] ?? KOKORO_VOICES.en.female;
  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: args.text, voice: voiceId }),
  });
  if (!res.ok) throw new Error(`tts(kokoro): ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { audio?: { url?: string } };
  if (!data.audio?.url) throw new Error("tts(kokoro): no audio URL");
  return data.audio.url;
}

async function elevenTts(args: {
  text: string;
  language: string;
  voice: string;
  apiKey: string;
}): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2", {
    method: "POST",
    headers: { Authorization: `Key ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      voice: ELEVEN_VOICES[args.voice] ?? ELEVEN_VOICES.female,
      language_code: args.language, // ISO 639-1, e.g. "ar"
    }),
  });
  if (!res.ok) throw new Error(`tts(elevenlabs): ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { audio?: { url?: string } };
  if (!data.audio?.url) throw new Error("tts(elevenlabs): no audio URL");
  return data.audio.url;
}

/** Voiceover audio URL, routed to the right engine per language. */
export async function ttsGenerate(args: {
  text: string;
  language: string;
  voice: string; // "female" | "male"
  apiKey: string;
}): Promise<string> {
  // Kokoro covers en/fr well and cheaply; Arabic (and any non-Kokoro lang)
  // goes to ElevenLabs multilingual.
  return args.language in KOKORO_ENDPOINTS
    ? kokoroTts(args)
    : elevenTts(args);
}

/** Background music from a text prompt (fal-ai/stable-audio, queue API). */
export async function musicGenerate(args: {
  prompt: string;
  durationSeconds?: number; // max 47s per the model
  apiKey: string;
}): Promise<string> {
  const headers = {
    Authorization: `Key ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  const submit = await fetch("https://queue.fal.run/fal-ai/stable-audio", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: args.prompt,
      seconds_total: Math.min(args.durationSeconds ?? 30, 47),
    }),
  });
  if (!submit.ok) {
    throw new Error(`music submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`);
  }
  const job = (await submit.json()) as { status_url?: string; response_url?: string };
  if (!job.status_url || !job.response_url) {
    throw new Error("music: queue response missing status/response URLs");
  }

  const deadline = Date.now() + 4 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("music: timed out");
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(job.status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`music: generation ${s.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(`music result: ${result.status} ${(await result.text()).slice(0, 200)}`);
  }
  const data = (await result.json()) as { audio_file?: { url?: string } };
  if (!data.audio_file?.url) throw new Error("music: no audio URL in response");
  return data.audio_file.url;
}

/** One-shot sound effect from a text prompt (fal-ai/elevenlabs/sound-effects/v2, queue API). */
export async function sfxGenerate(args: {
  prompt: string;
  durationSeconds?: number; // 0.5-22s per the model
  apiKey: string;
}): Promise<string> {
  const headers = {
    Authorization: `Key ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  const body: Record<string, unknown> = { text: args.prompt };
  if (args.durationSeconds) body.duration_seconds = Math.min(args.durationSeconds, 22);

  const submit = await fetch("https://queue.fal.run/fal-ai/elevenlabs/sound-effects/v2", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!submit.ok) {
    throw new Error(`sfx submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`);
  }
  const job = (await submit.json()) as { status_url?: string; response_url?: string };
  if (!job.status_url || !job.response_url) {
    throw new Error("sfx: queue response missing status/response URLs");
  }

  const deadline = Date.now() + 2 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("sfx: timed out");
    await new Promise((r) => setTimeout(r, 3000));
    const st = await fetch(job.status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`sfx: generation ${s.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(`sfx result: ${result.status} ${(await result.text()).slice(0, 200)}`);
  }
  const data = (await result.json()) as { audio?: { url?: string } };
  if (!data.audio?.url) throw new Error("sfx: no audio URL in response");
  return data.audio.url;
}

/**
 * Curated VEED avatar presets (ids verified against the model's OpenAPI spec).
 * Vertical framing — right for Reels/TikTok/Stories placements.
 */
export const AVATARS: Array<{ id: string; label: string }> = [
  { id: "emily_vertical_primary", label: "Emily — casual creator" },
  { id: "marcus_vertical_primary", label: "Marcus — energetic creator" },
  { id: "mira_vertical_primary", label: "Mira — modern creator" },
  { id: "elena_vertical_primary", label: "Elena — warm & friendly" },
  { id: "jasmine_vertical_walking", label: "Jasmine — walking vlog" },
  { id: "aisha_vertical_walking", label: "Aisha — walking vlog" },
];

/** Lip-synced talking-creator video from a script (VEED avatars, queue API). */
export async function avatarGenerate(args: {
  text: string;
  avatarId: string;
  apiKey: string;
}): Promise<string> {
  const headers = {
    Authorization: `Key ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  const submit = await fetch("https://queue.fal.run/veed/avatars/text-to-video", {
    method: "POST",
    headers,
    body: JSON.stringify({
      avatar_id: args.avatarId,
      text: args.text.slice(0, 2000),
    }),
  });
  if (!submit.ok) {
    throw new Error(
      `avatar submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`,
    );
  }
  const job = (await submit.json()) as {
    status_url?: string;
    response_url?: string;
  };
  if (!job.status_url || !job.response_url) {
    throw new Error("avatar: queue response missing status/response URLs");
  }

  const deadline = Date.now() + 12 * 60_000; // avatars render slowly
  for (;;) {
    if (Date.now() > deadline) throw new Error("avatar: timed out");
    await new Promise((r) => setTimeout(r, 6000));
    const st = await fetch(job.status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`avatar: generation ${s.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(
      `avatar result: ${result.status} ${(await result.text()).slice(0, 200)}`,
    );
  }
  const data = (await result.json()) as { video?: { url?: string } };
  if (!data.video?.url) throw new Error("avatar: no video URL in response");
  return data.video.url;
}

/**
 * Bring-your-own avatar: ByteDance OmniHuman turns the user's OWN photo +
 * a voiceover audio track into a realistic lip-synced talking-head video.
 * The photo may be a public URL or a data: URI (fal accepts both).
 */
export async function omnihumanGenerate(args: {
  imageUrl: string;
  audioUrl: string;
  apiKey: string;
}): Promise<string> {
  const headers = {
    Authorization: `Key ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  const submit = await fetch("https://queue.fal.run/fal-ai/bytedance/omnihuman", {
    method: "POST",
    headers,
    body: JSON.stringify({ image_url: args.imageUrl, audio_url: args.audioUrl }),
  });
  if (!submit.ok) {
    throw new Error(`omnihuman submit: ${submit.status} ${(await submit.text()).slice(0, 200)}`);
  }
  const job = (await submit.json()) as { status_url?: string; response_url?: string };
  if (!job.status_url || !job.response_url) {
    throw new Error("omnihuman: queue response missing status/response URLs");
  }

  const deadline = Date.now() + 12 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("omnihuman: timed out");
    await new Promise((r) => setTimeout(r, 6000));
    const st = await fetch(job.status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`omnihuman: generation ${s.status}`);
    }
  }

  const result = await fetch(job.response_url, { headers });
  if (!result.ok) {
    throw new Error(`omnihuman result: ${result.status} ${(await result.text()).slice(0, 200)}`);
  }
  const data = (await result.json()) as { video?: { url?: string } };
  if (!data.video?.url) throw new Error("omnihuman: no video URL in response");
  return data.video.url;
}

interface ComposeKeyframe {
  url: string;
  timestamp: number; // ms
  duration: number; // ms
}

/**
 * Concatenate scene clips and lay the voiceover (and optional background
 * music) under them. Uses the queue API — assembly of several clips takes a
 * while. Note: the compose API's track schema has no documented volume/gain
 * field, so both audio tracks play at their native levels.
 */
export async function composeVideo(args: {
  scenes: Array<{ url: string; durationSeconds: number }>;
  audioUrl?: string | null;
  musicUrl?: string | null;
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
  if (args.musicUrl) {
    tracks.push({
      id: "music",
      type: "audio",
      keyframes: [{ url: args.musicUrl, timestamp: 0, duration: t }],
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
