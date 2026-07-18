"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { navSections } from "./sidebar-nav";
import type { SearchResult } from "@/app/api/search/route";

interface PaletteItem {
  label: string;
  subtitle: string;
  href: string;
}

const KIND_ICON: Record<SearchResult["kind"], string> = {
  campaign: "📣",
  creative: "🎨",
  brand: "🏷️",
  product: "📦",
  video: "🎬",
  page: "🌐",
};

/**
 * Global command palette (Ctrl/Cmd+K) — mounted once in the dashboard layout
 * so the shortcut works from any page. Combines the static nav list (from
 * sidebar-nav's own navSections, so it can't drift out of sync) with live
 * org-scoped search results from /api/search once the query is 2+ chars.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const navCommands = useMemo<PaletteItem[]>(
    () => navSections.flatMap((s) => s.items).map((i) => ({ label: i.label, subtitle: "Go to", href: i.href })),
    [],
  );

  // Registered once; the handler itself only runs on a real keydown event, so
  // setState here is a normal event-driven update, not an effect-body reset
  // (mirrors the Escape-key handler pattern in MobileNav below).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prevOpen) => {
          const nextOpen = !prevOpen;
          if (nextOpen) {
            setQuery("");
            setResults([]);
            setActiveIndex(0);
          }
          return nextOpen;
        });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus is a DOM side effect, not a state reset — no setState here.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [trimmedQuery, open]);

  // Short queries never fetch — derive the empty state at render time instead
  // of clearing `results` via an effect.
  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  const needle = trimmedQuery.toLowerCase();
  const filteredNav = needle ? navCommands.filter((c) => c.label.toLowerCase().includes(needle)) : navCommands;

  const combined: Array<PaletteItem & { icon: string }> = [
    ...filteredNav.map((c) => ({ ...c, icon: "→" })),
    ...visibleResults.map((r) => ({ label: r.label, subtitle: r.subtitle, href: r.href, icon: KIND_ICON[r.kind] })),
  ];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, combined.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = combined[activeIndex];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-app-border px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-app-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onInputKeyDown}
            placeholder="Search campaigns, brands, products… or jump to a page"
            className="flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-app-text-subtle"
          />
          <kbd className="shrink-0 rounded border border-app-border-strong px-1.5 py-0.5 text-[10px] text-app-text-subtle">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {combined.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-app-text-subtle">
              {loading ? "Searching…" : "No matches"}
            </p>
          ) : (
            combined.map((item, i) => (
              <button
                key={`${item.href}-${item.label}-${i}`}
                type="button"
                onClick={() => go(item.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === activeIndex ? "bg-amber-400/10 text-amber-300" : "text-app-text hover:bg-app-surface-2"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-xs text-app-text-subtle">{item.subtitle}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
