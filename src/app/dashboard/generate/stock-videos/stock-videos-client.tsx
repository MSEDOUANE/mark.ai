"use client";

import { useEffect, useRef, useState } from "react";

interface StockVideo {
  id: string;
  thumb: string;
  preview: string;
  full: string;
  durationSeconds: number;
  photographer: string;
  source: "pexels";
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function StockVideosClient() {
  const [query, setQuery] = useState("lifestyle product");
  const [videos, setVideos] = useState<StockVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<StockVideo | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string, p: number, append = false) {
    if (!q.trim()) { setVideos([]); setHasMore(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock/videos?q=${encodeURIComponent(q)}&page=${p}`);
      const data = (await res.json()) as { videos: StockVideo[]; total: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Search failed");
      setVideos((prev) => append ? [...prev, ...data.videos] : data.videos);
      setHasMore(data.videos.length === 12);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); search(query, 1); }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    search(query, next, true);
  }

  async function copyUrl() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-app-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search millions of stock videos…"
          className="w-full rounded-2xl border border-app-border-strong bg-app-surface py-4 pl-12 pr-5 text-base text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500"
        />
        {loading && (
          <svg className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-app-text-subtle" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {error && <p className="rounded-xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}

      {/* Selected video detail panel */}
      {selected && (
        <div className="overflow-hidden rounded-2xl border border-app-border-strong bg-app-surface">
          <div className="flex flex-col gap-0 sm:flex-row">
            <div className="relative aspect-video shrink-0 overflow-hidden bg-black sm:w-96">
              <video
                key={selected.id}
                src={selected.preview}
                poster={selected.thumb}
                controls
                autoPlay
                muted
                loop
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                <p className="text-xs text-app-text-subtle">
                  Video by <span className="font-semibold text-app-text">{selected.photographer}</span>
                  {" "}on <span className="capitalize">{selected.source}</span>
                  {" · "}{formatDuration(selected.durationSeconds)}
                </p>
                <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-lg border border-app-border-strong bg-app-bg px-3 py-2">
                  <p className="flex-1 truncate text-xs text-app-text-muted">{selected.full}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyUrl}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    copied ? "bg-emerald-500 text-white" : "bg-app-surface-2 text-app-text hover:bg-app-surface-2"
                  }`}
                >
                  {copied ? (
                    <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                  ) : (
                    <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>Copy URL</>
                  )}
                </button>

                <a
                  href={selected.full}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-app-border-strong px-4 py-2.5 text-sm font-semibold text-app-text transition-colors hover:border-zinc-500 hover:text-app-text"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </a>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-auto self-start text-xs text-app-text-subtle hover:text-app-text-muted"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video grid */}
      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((video) => {
              const sel = video.id === selected?.id;
              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => setSelected((prev) => prev?.id === video.id ? null : video)}
                  title={`Video by ${video.photographer}`}
                  className={`group relative aspect-video overflow-hidden rounded-xl border-2 transition-all ${
                    sel ? "border-amber-400 ring-2 ring-amber-400/30" : "border-transparent hover:border-app-border-emphasis"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={video.thumb}
                    alt={video.photographer}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="rounded-full bg-white/90 p-2">
                      <svg className="h-4 w-4 translate-x-0.5 text-zinc-900" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </div>
                  </div>
                  {sel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-400/20">
                      <div className="rounded-full bg-amber-400 p-1.5 shadow-lg">
                        <svg className="h-3.5 w-3.5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {formatDuration(video.durationSeconds)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-app-text-subtle">Videos from Pexels · free to use with attribution</p>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border border-app-border-strong px-4 py-2 text-sm text-app-text-muted transition-colors hover:border-zinc-500 hover:text-app-text disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      ) : !loading && query.trim() ? (
        <p className="py-16 text-center text-sm text-app-text-subtle">No videos found for &ldquo;{query}&rdquo;</p>
      ) : null}
    </div>
  );
}
