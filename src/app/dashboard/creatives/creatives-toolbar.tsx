"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface ToolbarProps {
  total: number;
  generating: number;
  ready: number;
  tags?: string[];
}

export function CreativesToolbar({ total, generating, ready, tags = [] }: ToolbarProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "all";
  const sort   = searchParams.get("sort")   ?? "newest";
  const tag    = searchParams.get("tag")    ?? "all";

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "newest") {
      p.delete(key);
    } else {
      p.set(key, value);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {/* Stats chips */}
      <div className="flex items-center gap-2 text-sm">
        <button type="button" onClick={() => update("status", "all")}
          className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
            status === "all"
              ? "bg-app-surface-2 text-app-text"
              : "text-app-text-subtle hover:text-app-text"
          }`}>
          All <span className="ml-1 text-app-text-subtle">{total}</span>
        </button>

        {generating > 0 && (
          <button type="button" onClick={() => update("status", "generating")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              status === "generating"
                ? "bg-amber-950/60 text-amber-300"
                : "text-app-text-subtle hover:text-app-text"
            }`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            Generating <span className="ml-0.5 text-app-text-subtle">{generating}</span>
          </button>
        )}

        <button type="button" onClick={() => update("status", "ready")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors ${
            status === "ready"
              ? "bg-emerald-950/60 text-emerald-300"
              : "text-app-text-subtle hover:text-app-text"
          }`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Ready <span className="ml-0.5 text-app-text-subtle">{ready}</span>
        </button>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => update("tag", tag === t ? "all" : t)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                tag === t ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-app-border-strong text-app-text-subtle hover:text-app-text"
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-app-text-subtle">Sort by</span>
        <select value={sort} onChange={(e) => update("sort", e.target.value)}
          className="rounded-lg border border-app-border-strong bg-app-surface px-3 py-1.5 text-xs text-app-text outline-none focus:border-zinc-500">
          <option value="newest">Newest first</option>
          <option value="score">Highest score</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
    </div>
  );
}
