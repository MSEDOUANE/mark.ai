"use client";

import { useActionState } from "react";
import { generateAudienceInsights, type AudienceInsightsState, type AudienceSegment } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const SIZE_COLORS: Record<string, string> = {
  Large: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Niche: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Analyzing audience…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>Generate insights</>
      )}
    </button>
  );
}

function SegmentCard({ segment, isPrimary }: { segment: AudienceSegment; isPrimary: boolean }) {
  const sizeClass = SIZE_COLORS[segment.sizeSignal] ?? "bg-zinc-700/30 text-zinc-300 border-zinc-600";
  return (
    <article className={`overflow-hidden rounded-2xl border bg-zinc-900 transition-shadow hover:shadow-xl hover:shadow-black/30 ${
      isPrimary ? "border-amber-400/40" : "border-zinc-800"
    }`}>
      {isPrimary && (
        <div className="flex items-center gap-2 bg-amber-400/10 px-5 py-2 text-xs font-semibold text-amber-400">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
          Recommended focus
        </div>
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold">{segment.name}</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sizeClass}`}>{segment.sizeSignal}</span>
        </div>
        <p className="mt-1.5 text-sm text-zinc-400">{segment.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-zinc-600">Age</p><p className="mt-0.5 text-zinc-300">{segment.demographics.ageRange}</p></div>
          <div><p className="text-zinc-600">Gender</p><p className="mt-0.5 text-zinc-300">{segment.demographics.gender}</p></div>
          <div><p className="text-zinc-600">Income</p><p className="mt-0.5 text-zinc-300">{segment.demographics.incomeLevel}</p></div>
          <div><p className="text-zinc-600">Location</p><p className="mt-0.5 text-zinc-300">{segment.demographics.location}</p></div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Interests</p>
          <div className="flex flex-wrap gap-1.5">
            {segment.interests.map((i) => <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">{i}</span>)}
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Online behavior</p>
          <ul className="space-y-1">
            {segment.onlineBehavior.map((b) => (
              <li key={b} className="flex items-start gap-1.5 text-sm text-zinc-300"><span className="mt-0.5 text-blue-400">•</span>{b}</li>
            ))}
          </ul>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Pain points</p>
          <ul className="space-y-1">
            {segment.painPoints.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-sm text-zinc-300"><span className="mt-0.5 text-red-400">•</span>{p}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {segment.preferredChannels.map((c) => (
            <span key={c} className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400">{c}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function AudienceInsightsGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<AudienceInsightsState, FormData>(
    generateAudienceInsights,
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
            <h3 className="font-semibold">About your product</h3>
            <div>
              <label className="text-sm text-zinc-400">Product / brand name *</label>
              <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Product description</label>
              <textarea name="description" rows={3}
                placeholder="What it is, what it does, what makes it special"
                className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Target market / geography</label>
              <input name="market" placeholder="Morocco, urban areas, mid-to-high income" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Known competitors</label>
              <input name="competitors" placeholder="Who else serves this market" className={`mt-1.5 ${field}`} />
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
            <p className="text-4xl">🔎</p>
            <p className="mt-4 font-medium text-zinc-400">Your audience segments will appear here</p>
            <p className="mt-1.5 text-sm text-zinc-600">Fill in the product brief to get 3-5 actionable segments.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-zinc-400">Segmenting your addressable audience…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result, productName } = state;
          const focusName = result.recommendedFocus.split(" ")[0];
          return (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Market summary for {productName}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{result.marketSummary}</p>
                <div className="mt-3 rounded-xl bg-amber-950/30 border border-amber-400/20 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Opportunity gap</p>
                  <p className="text-sm text-zinc-200">{result.opportunityGap}</p>
                </div>
              </div>

              {result.segments.map((s, i) => (
                <SegmentCard key={i} segment={s} isPrimary={s.name.includes(focusName)} />
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}
