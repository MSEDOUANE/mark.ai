"use client";

import { useState } from "react";

export interface BrandContextOption {
  id: string;
  name: string;
  tone: string | null;
  description: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

/**
 * Compact brand chip row for the Generate tools. Render INSIDE the tool's
 * <form>: selecting a brand submits its voice (name/tone/description) via
 * hidden fields so the generation is written in-brand. Toggle off to go
 * brandless. Purely additive — tools keep their own fields.
 */
export function BrandContextPicker({
  brands,
  onSelect,
}: {
  brands: BrandContextOption[];
  onSelect?: (brand: BrandContextOption | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = brands.find((b) => b.id === selectedId) ?? null;

  if (brands.length === 0) return null;

  function toggle(b: BrandContextOption) {
    const next = selectedId === b.id ? null : b.id;
    setSelectedId(next);
    onSelect?.(next ? b : null);
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 className="font-semibold">Brand voice</h3>
      <p className="mt-0.5 text-sm text-zinc-400">
        Pick a brand — the output is written in its voice.
      </p>

      <input type="hidden" name="brandProfileId" value={selected?.id ?? ""} />
      <input type="hidden" name="brandName" value={selected?.name ?? ""} />
      <input type="hidden" name="brandTone" value={selected?.tone ?? ""} />
      <input type="hidden" name="brandDescription" value={selected?.description ?? ""} />

      <div className="mt-3 flex flex-wrap gap-2">
        {brands.map((b) => {
          const sel = b.id === selectedId;
          const color =
            b.primaryColor && /^#[0-9a-f]{6}$/i.test(b.primaryColor)
              ? b.primaryColor
              : "#7c3aed";
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all ${
                sel
                  ? "border-amber-400 bg-amber-950/30 text-amber-200 ring-1 ring-amber-400"
                  : "border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {b.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.logoUrl}
                  alt=""
                  className="h-4 w-4 rounded object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {b.name}
              {sel && (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {selected?.tone ? (
        <p className="mt-2.5 text-xs text-zinc-500">
          Voice: <span className="text-zinc-400 capitalize">{selected.tone}</span>
        </p>
      ) : null}
    </div>
  );
}
