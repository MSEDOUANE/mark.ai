"use client";

import { useActionState } from "react";
import { generateMarketingCalendar, type CalendarState, type CalendarEntry } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  low: "bg-zinc-700/40 text-zinc-400 border-zinc-600",
};

const TYPE_ICONS: Record<string, string> = {
  religious: "🌙",
  cultural: "🎉",
  retail: "🛍️",
  seasonal: "🗓️",
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Building calendar…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
        </svg>Build calendar</>
      )}
    </button>
  );
}

function EntryCard({ entry }: { entry: CalendarEntry }) {
  const priorityClass = PRIORITY_COLORS[entry.priority] ?? PRIORITY_COLORS.low;
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-shadow hover:shadow-xl hover:shadow-black/30">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[entry.type] ?? "🗓️"}</span>
          <h3 className="text-lg font-bold">{entry.occasion}</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityClass}`}>{entry.priority}</span>
          <span className="ml-auto text-xs text-zinc-500">{entry.window}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">{entry.relevance}</p>

        <div className="mt-3 rounded-xl bg-amber-950/25 border border-amber-400/20 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1">Campaign angle</p>
          <p className="text-sm text-zinc-200">{entry.campaignAngle}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded-full bg-zinc-800 px-2.5 py-1">⏱ {entry.prepLeadTime}</span>
          {entry.suggestedChannels.map((c) => (
            <span key={c} className="rounded-full bg-zinc-800 px-2.5 py-1 font-medium">{c}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function CalendarGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<CalendarState, FormData>(
    generateMarketingCalendar,
    { status: "idle" },
  );

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div>
        <form action={action} className="space-y-5">
          <BrandContextPicker brands={brands} />
          <LanguagePicker />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="font-semibold">Plan around</h3>
            <div>
              <label className="text-sm text-zinc-400">Product / brand name *</label>
              <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Product description</label>
              <textarea name="description" rows={3}
                placeholder="What it is, who it's for"
                className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Primary market</label>
              <input name="market" defaultValue="Morocco / MENA" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Planning horizon</label>
              <select name="horizon" defaultValue="6m" className={`mt-1.5 ${field}`}>
                <option value="3m">Next 3 months</option>
                <option value="6m">Next 6 months</option>
                <option value="12m">Next 12 months</option>
              </select>
            </div>
          </div>

          {state.status === "error" && (
            <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
          )}

          <SubmitButton pending={pending} />
        </form>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {state.status === "idle" && !pending && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <p className="text-4xl">🗓️</p>
            <p className="mt-4 font-medium text-zinc-400">Your seasonal calendar will appear here</p>
            <p className="mt-1.5 text-sm text-zinc-600">Describe the product to get a prioritized calendar of moments to plan around.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-zinc-400">Mapping seasonal moments…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result, productName, horizon } = state;
          return (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Calendar for {productName} · {horizon}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{result.horizonSummary}</p>
                {result.quickWins.length > 0 && (
                  <div className="mt-3 rounded-xl bg-emerald-950/25 border border-emerald-400/20 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1.5">Act on these now</p>
                    <ul className="space-y-1">
                      {result.quickWins.map((q) => (
                        <li key={q} className="flex items-start gap-1.5 text-sm text-zinc-200"><span className="mt-0.5 text-emerald-400">→</span>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.entries.map((e, i) => <EntryCard key={i} entry={e} />)}
            </>
          );
        })()}
      </div>
    </div>
  );
}
