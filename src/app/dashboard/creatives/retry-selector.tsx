"use client";

import { useState, useTransition } from "react";
import { retryStuckCreatives } from "./actions";

interface StuckCreative {
  id: string;
  headline?: string;
  productName?: string;
  status: string;
}

export function RetrySelector({ creatives }: { creatives: StuckCreative[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(creatives.map((c) => c.id)));
  const [pending, startTransition] = useTransition();

  if (creatives.length === 0) return null;

  const allChecked = selected.size === creatives.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(creatives.map((c) => c.id)));
  }

  function handleRetry() {
    const fd = new FormData();
    selected.forEach((id) => fd.append("ids", id));
    startTransition(() => retryStuckCreatives(fd));
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-950/20 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-amber-400/40 bg-app-surface transition-colors hover:border-amber-400"
            aria-label={allChecked ? "Deselect all" : "Select all"}
          >
            {allChecked && (
              <svg className="h-3 w-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {selected.size > 0 && !allChecked && (
              <span className="h-0.5 w-2.5 rounded bg-amber-400" />
            )}
          </button>
          <span className="text-sm font-medium text-amber-300">
            {creatives.length} stuck creative{creatives.length !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={handleRetry}
          disabled={selected.size === 0 || pending}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
          Retry {selected.size > 0 ? selected.size : ""}
        </button>
      </div>

      {/* Creative rows */}
      <ul className="mt-3 space-y-1.5">
        {creatives.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => toggle(c.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                selected.has(c.id)
                  ? "bg-amber-400/10 hover:bg-amber-400/15"
                  : "bg-app-surface/60 hover:bg-app-surface-2/60"
              }`}
            >
              {/* Checkbox */}
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                selected.has(c.id) ? "border-amber-400 bg-amber-400/20" : "border-app-border-emphasis"
              }`}>
                {selected.has(c.id) && (
                  <svg className="h-2.5 w-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </span>

              {/* Label */}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-app-text">
                  {c.headline ?? c.productName ?? "Untitled creative"}
                </span>
                {c.productName && c.headline && (
                  <span className="block truncate text-xs text-app-text-subtle">{c.productName}</span>
                )}
              </span>

              {/* Status pill */}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                c.status === "generating"
                  ? "bg-blue-400/10 text-blue-400"
                  : "bg-app-surface-2 text-app-text-muted"
              }`}>
                {c.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
