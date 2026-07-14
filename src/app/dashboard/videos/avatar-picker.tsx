"use client";

import { useRef, useState } from "react";

const field =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

/**
 * Avatar chooser for the "UGC Avatar" style: pick a ready-made presenter, or
 * upload your own photo to be the talking creator (drives the OmniHuman path).
 * Renders inside the studio form — the hidden `avatarImageUrl` submits the
 * uploaded photo; when empty the selected preset `avatar` is used.
 */
export function AvatarPicker({
  presets,
}: {
  presets: Array<{ id: string; label: string }>;
}) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [photo, setPhoto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB"); return; }
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setPhoto(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="text-sm">
      <span className="text-zinc-400">Avatar <span className="text-zinc-600">(UGC Avatar style)</span></span>

      {/* Mode toggle */}
      <div className="mt-1.5 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1">
        {([["preset", "Ready-made"], ["custom", "Upload your own"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Preset select — always in the DOM so its value submits; hidden in custom mode */}
      <div className={mode === "preset" ? "mt-2" : "hidden"}>
        <select name="avatar" className={field} defaultValue={presets[0]?.id}>
          {presets.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Custom upload */}
      <div className={mode === "custom" ? "mt-2" : "hidden"}>
        {/* When custom, submit the uploaded photo; empty otherwise. */}
        <input type="hidden" name="avatarImageUrl" value={mode === "custom" ? photo : ""} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {photo ? (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="avatar" className="h-16 w-16 rounded-lg object-cover" />
            <div className="flex-1 text-xs text-emerald-400">Your avatar photo is set.</div>
            <button type="button" onClick={() => { setPhoto(""); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-xs text-zinc-500 hover:text-zinc-300">Remove</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-60">
            {uploading ? "Uploading…" : "Upload a face photo (front-facing, clear — max 5 MB)"}
          </button>
        )}
        {error ? <p className="mt-1.5 text-xs text-red-400">{error}</p> : null}
        <p className="mt-1.5 text-[11px] text-zinc-600">
          A clear front-facing portrait works best — it becomes the presenter,
          speaking your script in the chosen voice &amp; language.
        </p>
      </div>
    </div>
  );
}
