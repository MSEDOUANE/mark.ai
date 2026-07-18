"use client";

import { useRef, useState } from "react";
import { RETOUCH_TOOLS } from "@/lib/creative/retouch-tools";
import { MaskCanvas, type MaskCanvasHandle } from "./mask-canvas";

export function RetouchClient() {
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string>(RETOUCH_TOOLS[0].id);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [maskDirty, setMaskDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const maskRef = useRef<MaskCanvasHandle>(null);

  const tool = RETOUCH_TOOLS.find((t) => t.id === toolId)!;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("File too large (max 5 MB)"); return; }
    setUploading(true); setUploadError(null); setResultUrl(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setPhotoUrl(url);
      setMaskDirty(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function selectTool(id: string) {
    setToolId(id);
    setResultUrl(null);
    setGenError(null);
    maskRef.current?.clear();
    setMaskDirty(false);
  }

  async function handleGenerate() {
    if (!photoUrl) return;
    let maskUrl: string | null = null;
    if (tool.needsMask) {
      maskUrl = maskRef.current?.exportMask() ?? null;
      if (!maskUrl) { setGenError("Brush over an area first."); return; }
    }
    setGenerating(true); setGenError(null); setResultUrl(null);
    try {
      const res = await fetch("/api/retouch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, imageUrl: photoUrl, maskUrl }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Editing failed");
      setResultUrl(json.url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Editing failed");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !!photoUrl && !generating && (!tool.needsMask || maskDirty);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Upload */}
        <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
          <h2 className="font-semibold">1. Upload a photo</h2>
          <p className="mt-1 text-sm text-app-text-muted">Product shot, portrait, or any image you want to clean up.</p>
          <div className="mt-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {photoUrl ? (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border border-app-border-strong bg-app-bg py-2.5 text-xs font-semibold text-app-text hover:border-zinc-500 hover:text-app-text">
                Change photo
              </button>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-app-border-emphasis bg-app-bg py-10 text-sm text-app-text-muted transition-colors hover:border-zinc-500 hover:text-app-text disabled:opacity-60">
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

        {/* Tool picker */}
        <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
          <h2 className="font-semibold">2. Choose a tool</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {RETOUCH_TOOLS.map((t) => {
              const on = t.id === toolId;
              return (
                <button key={t.id} type="button" onClick={() => selectTool(t.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    on ? "border-amber-400/50 bg-amber-950/25 ring-1 ring-amber-400" : "border-app-border-strong bg-app-bg/50 hover:border-app-border-emphasis"
                  }`}>
                  <span className="text-lg">{t.icon}</span>
                  <span className={`text-xs font-semibold ${on ? "text-amber-200" : "text-app-text"}`}>{t.label}</span>
                  <span className="text-[10px] leading-snug text-app-text-subtle">{t.description}</span>
                  {t.needsMask && <span className="mt-0.5 rounded bg-app-surface-2 px-1.5 py-0.5 text-[9px] text-app-text-muted">needs brush</span>}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={handleGenerate} disabled={!canGenerate}
          className="w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-300 hover:to-orange-300 disabled:opacity-50">
          {generating ? (
            <span className="flex items-center justify-center gap-2.5">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Applying {tool.label}…
            </span>
          ) : (
            `Apply ${tool.label}`
          )}
        </button>
        {genError && <p className="text-center text-xs text-red-400">{genError}</p>}
        {!photoUrl && <p className="text-center text-xs text-app-text-subtle">Upload a photo to start editing.</p>}
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {!photoUrl ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-app-border text-center">
            <span className="text-3xl">🪄</span>
            <p className="text-sm text-app-text-subtle">Upload a photo, pick a tool, and your edited image appears here.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-app-text-subtle">
                {tool.needsMask ? "Brush the area to remove" : "Source"}
              </p>
              {tool.needsMask ? (
                <MaskCanvas ref={maskRef} imageUrl={photoUrl} onDirtyChange={setMaskDirty} />
              ) : (
                <div className="overflow-hidden rounded-xl border border-app-border-strong bg-app-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Source" className="block w-full object-contain" />
                </div>
              )}
            </div>

            {(generating || resultUrl) && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-app-text-subtle">Result</p>
                {generating ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-app-border bg-app-surface">
                    <svg className="h-7 w-7 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                ) : resultUrl ? (
                  <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
                    <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
                      <span className="text-sm font-medium text-app-text">{tool.label}</span>
                      <a href={resultUrl} download target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-amber-400 hover:underline">Download</a>
                    </div>
                    {/* checkerboard hints at transparency for bg-removal results */}
                    <div className="bg-[conic-gradient(#3f3f46_90deg,#27272a_90deg_180deg,#3f3f46_180deg_270deg,#27272a_270deg)] bg-[length:20px_20px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resultUrl} alt={tool.label} className="block w-full object-contain" />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
