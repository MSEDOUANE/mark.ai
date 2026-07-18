"use client";

import { useState } from "react";
import { VOICE_LANGUAGES } from "@/lib/creative/image-models/fal-audio-video";

type Mode = "voice" | "music" | "sfx";

const MODES: { id: Mode; label: string; icon: string; blurb: string; placeholder: string; cta: string }[] = [
  {
    id: "voice",
    label: "Voice",
    icon: "🎙️",
    blurb: "Turn a script into a natural voiceover — including Arabic dialects.",
    placeholder: "Type the exact words you want spoken…",
    cta: "Generate voiceover",
  },
  {
    id: "music",
    label: "Music",
    icon: "🎵",
    blurb: "Describe a mood or genre — generate a background music bed.",
    placeholder: "e.g. upbeat lo-fi hip hop, 90 BPM, warm and optimistic",
    cta: "Generate music",
  },
  {
    id: "sfx",
    label: "Sound Effects",
    icon: "🔊",
    blurb: "Describe a single sound — a whoosh, a click, a door closing.",
    placeholder: "e.g. a satisfying product unboxing crinkle, close mic",
    cta: "Generate sound effect",
  },
];

export function AudioStudioClient() {
  const [mode, setMode] = useState<Mode>("voice");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("ar");
  const [voice, setVoice] = useState("female");
  const [duration, setDuration] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const active = MODES.find((m) => m.id === mode)!;

  function selectMode(id: Mode) {
    setMode(id);
    setResultUrl(null);
    setGenError(null);
  }

  async function handleGenerate() {
    if (!text.trim()) return;
    setGenerating(true); setGenError(null); setResultUrl(null);
    try {
      const res = await fetch("/api/audio-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: text.trim(),
          language,
          voice,
          durationSeconds: mode === "voice" ? undefined : duration,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Generation failed");
      setResultUrl(json.url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const field = "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => selectMode(m.id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === m.id
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-app-border-strong text-app-text-muted hover:border-zinc-500 hover:text-app-text"
            }`}>
            <span>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-app-text-muted">{active.blurb}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-4">
            <div>
              <label className="text-sm text-app-text-muted">
                {mode === "voice" ? "Script" : "Description"}
              </label>
              <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={active.placeholder}
                className={`mt-1.5 ${field}`} />
            </div>

            {mode === "voice" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-app-text-muted">Language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`mt-1.5 ${field}`}>
                    {VOICE_LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-app-text-muted">Voice</span>
                  <select value={voice} onChange={(e) => setVoice(e.target.value)} className={`mt-1.5 ${field}`}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
              </div>
            )}

            {mode !== "voice" && (
              <label className="block">
                <span className="text-sm text-app-text-muted">
                  Duration — {duration}s {mode === "music" ? "(max 47s)" : "(max 22s)"}
                </span>
                <input type="range" min={mode === "music" ? 5 : 1} max={mode === "music" ? 47 : 22}
                  value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-2 h-1 w-full cursor-pointer accent-amber-400" />
              </label>
            )}
          </div>

          <button type="button" onClick={handleGenerate} disabled={!text.trim() || generating}
            className="w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-300 hover:to-orange-300 disabled:opacity-50">
            {generating ? (
              <span className="flex items-center justify-center gap-2.5">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Working…
              </span>
            ) : active.cta}
          </button>
          {genError && <p className="text-center text-xs text-red-400">{genError}</p>}
        </div>

        {/* ── Result ───────────────────────────────────────────────────── */}
        <div>
          {!resultUrl && !generating ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-app-border text-center">
              <span className="text-3xl">{active.icon}</span>
              <p className="text-sm text-app-text-subtle">Your audio will appear here.</p>
            </div>
          ) : generating ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-app-border bg-app-surface">
              <svg className="h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : resultUrl ? (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-app-text">{active.label}</span>
                <a href={resultUrl} download target="_blank" rel="noreferrer"
                  className="text-xs font-semibold text-amber-400 hover:underline">Download</a>
              </div>
              <audio controls src={resultUrl} className="w-full" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
