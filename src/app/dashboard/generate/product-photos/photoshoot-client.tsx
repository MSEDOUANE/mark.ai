"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PHOTOSHOOT_STYLES, type PhotoshootStyle } from "@/lib/ai/photoshoot-styles";

type ResultItem = {
  styleId: string;
  label: string;
  url?: string;
  error?: string;
  /** Set once an "Animate" request for this result has been kicked off/resolved. */
  video?: { status: "generating" | "done" | "error"; url?: string; error?: string };
};

const CATEGORIES: { id: PhotoshootStyle["category"]; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "fashion", label: "Fashion" },
];

export function PhotoshootClient() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") === "fashion" ? "fashion" : "product";

  const [category, setCategory] = useState<PhotoshootStyle["category"]>(initialCategory);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const stylesForCategory = PHOTOSHOOT_STYLES.filter((s) => s.category === initialCategory);
  const [selected, setSelected] = useState<string[]>(
    stylesForCategory.slice(0, 3).map((s) => s.id),
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleStyles = PHOTOSHOOT_STYLES.filter((s) => s.category === category);

  function switchCategory(next: PhotoshootStyle["category"]) {
    setCategory(next);
    setSelected(PHOTOSHOOT_STYLES.filter((s) => s.category === next).slice(0, 3).map((s) => s.id));
    setResults([]);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("File too large (max 5 MB)"); return; }
    setUploading(true); setUploadError(null); setResults([]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setPhotoUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleStyle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleGenerate() {
    if (!photoUrl || selected.length === 0) return;
    setGenerating(true); setGenError(null); setResults([]);
    try {
      const res = await fetch("/api/product-photoshoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, styleIds: selected }),
      });
      const json = (await res.json()) as { results?: ResultItem[]; error?: string };
      if (!res.ok || !json.results) throw new Error(json.error ?? "Generation failed");
      setResults(json.results);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAnimate(r: ResultItem) {
    if (!r.url) return;
    setResults((prev) =>
      prev.map((x) => (x.styleId === r.styleId ? { ...x, video: { status: "generating" } } : x)),
    );
    try {
      const res = await fetch("/api/animate-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: r.url }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Animation failed");
      setResults((prev) =>
        prev.map((x) => (x.styleId === r.styleId ? { ...x, video: { status: "done", url: json.url } } : x)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Animation failed";
      setResults((prev) =>
        prev.map((x) => (x.styleId === r.styleId ? { ...x, video: { status: "error", error: message } } : x)),
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Upload */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="font-semibold">1. Upload your product photo</h2>
          <p className="mt-1 text-sm text-zinc-400">Any angle, any background — the AI keeps the product exact.</p>

          <div className="mt-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {photoUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Uploaded product" className="aspect-square w-full object-contain" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-xs font-semibold text-white transition-opacity hover:bg-black/85">
                  Change photo
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-10 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-60">
                {uploading ? (
                  <><svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading…</>
                ) : (
                  <><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>Upload photo (max 5 MB)</>
                )}
              </button>
            )}
            {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
          </div>
        </div>

        {/* Style picker */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="font-semibold">2. Pick shoot styles</h2>
          <p className="mt-1 text-sm text-zinc-400">Select one or more — each generates its own variant.</p>

          <div className="mt-3 flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => switchCategory(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === c.id
                    ? "border-amber-400 bg-amber-400/10 text-amber-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {visibleStyles.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggleStyle(s.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    on ? "border-amber-400/50 bg-amber-950/25 ring-1 ring-amber-400" : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                  }`}>
                  <span className="text-lg">{s.icon}</span>
                  <span className={`text-xs font-semibold ${on ? "text-amber-200" : "text-zinc-300"}`}>{s.label}</span>
                  <span className="text-[10px] text-zinc-500">{s.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={handleGenerate} disabled={!photoUrl || selected.length === 0 || generating}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-300 hover:to-orange-300 disabled:opacity-50">
          {generating ? (
            <span className="flex items-center justify-center gap-2.5">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Shooting {selected.length} variant{selected.length !== 1 ? "s" : ""}…
            </span>
          ) : (
            `Generate ${selected.length || ""} photo${selected.length !== 1 ? "s" : ""}`
          )}
        </button>
        {genError && <p className="text-center text-xs text-red-400">{genError}</p>}
        {!photoUrl && <p className="text-center text-xs text-zinc-600">Upload a photo to enable generation.</p>}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div>
        {results.length === 0 && !generating ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 text-center">
            <span className="text-3xl">📸</span>
            <p className="text-sm text-zinc-500">Your professional shots will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {generating &&
              selected.map((id) => (
                <div key={id} className="flex aspect-square animate-pulse flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900">
                  <svg className="h-6 w-6 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <p className="text-xs text-zinc-500">{PHOTOSHOOT_STYLES.find((s) => s.id === id)?.label}</p>
                </div>
              ))}
            {results.map((r) => (
              <div key={r.styleId} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                  <span className="text-sm font-medium text-zinc-200">{r.label}</span>
                  {r.url ? (
                    <a href={r.url} download target="_blank" rel="noreferrer"
                      className="text-xs font-semibold text-amber-400 hover:underline">
                      Download
                    </a>
                  ) : null}
                </div>
                {r.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.url} alt={r.label} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-zinc-950 px-4 text-center">
                    <span className="text-2xl">⚠️</span>
                    <p className="text-xs text-red-400">{r.error ?? "Failed to generate"}</p>
                  </div>
                )}
                {r.url && (
                  <div className="border-t border-zinc-800 px-4 py-2.5">
                    {!r.video ? (
                      <button type="button" onClick={() => handleAnimate(r)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-amber-400">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                        Animate → video
                      </button>
                    ) : r.video.status === "generating" ? (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Animating…
                      </span>
                    ) : r.video.status === "done" && r.video.url ? (
                      <a href={r.video.url} download target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Video ready — Download
                      </a>
                    ) : (
                      <span className="text-xs text-red-400">{r.video.error ?? "Animation failed"}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
