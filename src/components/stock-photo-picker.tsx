"use client";

import { useEffect, useRef, useState } from "react";

export interface StockPhoto {
  id: string;
  thumb: string;
  full: string;
  photographer: string;
  source: "pexels" | "unsplash";
}

interface Props {
  onSelect: (photo: StockPhoto) => void;
  selectedId?: string;
  defaultQuery?: string;
}

export function StockPhotoPicker({ onSelect, selectedId, defaultQuery = "" }: Props) {
  const [query, setQuery]     = useState(defaultQuery);
  const [photos, setPhotos]   = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string, p: number, append = false) {
    if (!q.trim()) { setPhotos([]); setHasMore(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}&page=${p}`);
      const data = (await res.json()) as { photos: StockPhoto[]; total: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Search failed");
      setPhotos((prev) => append ? [...prev, ...data.photos] : data.photos);
      setHasMore(data.photos.length === 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); search(query, 1); }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Auto-search default query on mount
  useEffect(() => {
    if (defaultQuery) search(defaultQuery, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    search(query, next, true);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stock photos… lifestyle, studio, product…"
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {photos.length > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo) => {
              const sel = photo.id === selectedId;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onSelect(photo)}
                  title={`Photo by ${photo.photographer}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    sel
                      ? "border-amber-400 ring-2 ring-amber-400/40"
                      : "border-transparent hover:border-zinc-500"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumb}
                    alt={photo.photographer}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {sel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-400/20">
                      <div className="rounded-full bg-amber-400 p-1">
                        <svg className="h-3 w-3 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">
              {photos[0].source === "pexels" ? "Photos from Pexels" : "Photos from Unsplash"}
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 underline-offset-2 hover:underline"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      ) : loading ? (
        <div className="flex justify-center py-6">
          <svg className="h-5 w-5 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : query.trim() ? (
        <p className="py-4 text-center text-xs text-zinc-600">No photos found for &ldquo;{query}&rdquo;</p>
      ) : (
        <p className="py-4 text-center text-xs text-zinc-600">Type to search for stock photos</p>
      )}
    </div>
  );
}
