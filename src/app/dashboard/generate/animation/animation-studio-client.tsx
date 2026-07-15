"use client";

import { useRef, useState } from "react";

export function AnimationStudioClient() {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setImageUrl(json.url);
      setVideoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function animate() {
    if (!imageUrl) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/animate-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Animation failed");
      setVideoUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Animation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-semibold">Animate a still image</h2>
        <p className="text-sm text-zinc-400">
          Upload an image and turn it into a short motion clip with subtle camera movement.
        </p>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-6 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        >
          {uploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}
        </button>

        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Uploaded source" className="aspect-square w-full object-contain" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={animate}
          disabled={!imageUrl || generating}
          className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {generating ? "Animating…" : "Generate motion clip"}
        </button>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-semibold">Preview</h2>
        {videoUrl ? (
          <video src={videoUrl} controls className="w-full rounded-xl border border-white/10 bg-zinc-950" />
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
            Your motion preview will appear here.
          </div>
        )}

        {videoUrl ? (
          <a href={videoUrl} download target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20 hover:text-white">
            Download clip
          </a>
        ) : null}
      </div>
    </div>
  );
}