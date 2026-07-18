"use client";

import { useActionState } from "react";
import {
  searchCompetitorAds,
  generateCompetitorReport,
  type AdLibraryState,
  type CompetitorReportState,
} from "./actions";

const EU_COUNTRIES = [
  { id: "FR", label: "France" },
  { id: "DE", label: "Germany" },
  { id: "ES", label: "Spain" },
  { id: "IT", label: "Italy" },
  { id: "NL", label: "Netherlands" },
  { id: "BE", label: "Belgium" },
  { id: "SE", label: "Sweden" },
  { id: "IE", label: "Ireland" },
  { id: "PL", label: "Poland" },
  { id: "PT", label: "Portugal" },
];

const field = "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function CompetitorAnalysisClient() {
  const [adState, adAction, adPending] = useActionState<AdLibraryState, FormData>(
    searchCompetitorAds,
    { status: "idle" },
  );
  const [reportState, reportAction, reportPending] = useActionState<CompetitorReportState, FormData>(
    generateCompetitorReport,
    { status: "idle" },
  );

  return (
    <div className="space-y-10">
      {/* ── Live Ad Library search ────────────────────────────────────── */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="text-xl">📡</span> Live competitor ads
        </h2>
        <p className="mt-1 text-sm text-app-text-muted">
          Real ads currently running, pulled from the Meta Ad Library. Coverage is EU-only (DSA transparency rules).
        </p>

        <form action={adAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px] text-sm">
            <span className="text-app-text-muted">Competitor / brand name</span>
            <input name="searchTerms" placeholder="e.g. Nike" className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-sm">
            <span className="text-app-text-muted">Country</span>
            <select name="country" defaultValue="FR" className={`mt-1.5 ${field}`}>
              {EU_COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={adPending}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
            {adPending ? <><Spinner />Searching…</> : "Search"}
          </button>
        </form>

        {adState.status === "error" && (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{adState.message}</p>
        )}

        {adState.status === "success" && (
          adState.ads.length === 0 ? (
            <p className="mt-4 text-sm text-app-text-subtle">No active ads found for &ldquo;{adState.searchTerms}&rdquo; in this country.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {adState.ads.map((ad, i) => (
                <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-app-text">{ad.pageName}</span>
                    {ad.startedAt && <span className="text-xs text-app-text-subtle">since {ad.startedAt.slice(0, 10)}</span>}
                  </div>
                  {ad.linkTitles[0] && <p className="mt-2 text-sm font-medium text-amber-300">{ad.linkTitles[0]}</p>}
                  {ad.bodies[0] && <p className="mt-1.5 text-sm text-app-text-muted line-clamp-4">{ad.bodies[0]}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {ad.platforms.map((p) => (
                      <span key={p} className="rounded-full bg-app-surface-2 px-2 py-0.5 text-[10px] text-app-text-muted">{p}</span>
                    ))}
                    {ad.snapshotUrl && (
                      <a href={ad.snapshotUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-amber-400 hover:underline">
                        View ad →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <div className="border-t border-app-border" />

      {/* ── AI competitor report ──────────────────────────────────────── */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="text-xl">🧭</span> AI competitor report
        </h2>
        <p className="mt-1 text-sm text-app-text-muted">
          A strategist&rsquo;s read on your competitive field — positioning, gaps, and angles to differentiate.
        </p>

        <form action={reportAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-app-text-muted">Your product / brand *</span>
            <input name="productName" placeholder="Argan Glow Serum" className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-app-text-muted">Description</span>
            <textarea name="description" rows={2} className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-sm">
            <span className="text-app-text-muted">Known competitors (optional)</span>
            <input name="competitors" placeholder="Names you already know" className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-sm">
            <span className="text-app-text-muted">Market / geography</span>
            <input name="market" placeholder="Morocco, urban" className={`mt-1.5 ${field}`} />
          </label>
          <button type="submit" disabled={reportPending}
            className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
            {reportPending ? <><Spinner />Analyzing…</> : "Generate report"}
          </button>
        </form>

        {reportState.status === "error" && (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{reportState.message}</p>
        )}

        {reportState.status === "success" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-950/20 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Differentiation opportunity</p>
              <p className="mt-1.5 text-sm text-app-text">{reportState.result.differentiationOpportunity}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-amber-400">Recommended angles</p>
              <ul className="mt-1.5 space-y-1">
                {reportState.result.recommendedAngles.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-amber-400">•</span>{a}</li>
                ))}
              </ul>
            </div>

            {reportState.result.competitors.map((c, i) => (
              <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-5">
                <h3 className="font-semibold text-app-text">{c.name}</h3>
                <p className="mt-1 text-sm text-app-text-muted">{c.positioning}</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Strengths</p><p className="mt-1 text-sm text-app-text">{c.strengths}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-red-400">Gaps</p><p className="mt-1 text-sm text-app-text">{c.gaps}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.estimatedAdAngles.map((a) => (
                    <span key={a} className="rounded-full bg-app-surface-2 px-2.5 py-1 text-[11px] text-app-text-muted">{a}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
