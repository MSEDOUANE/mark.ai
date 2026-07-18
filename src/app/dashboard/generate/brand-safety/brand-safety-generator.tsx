"use client";

import { useActionState } from "react";
import { checkBrandSafety, type BrandSafetyState, type SafetyIssue } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-app-surface-2/40 text-app-text-muted border-app-border-emphasis",
};

const VERDICT_STYLE: Record<string, { ring: string; label: string; text: string }> = {
  pass: { ring: "border-emerald-400/40", label: "Ship it", text: "text-emerald-300" },
  review: { ring: "border-amber-400/40", label: "Fix first", text: "text-amber-300" },
  fail: { ring: "border-red-400/40", label: "Do not ship", text: "text-red-300" },
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Checking…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>Check copy</>
      )}
    </button>
  );
}

function IssueCard({ issue }: { issue: SafetyIssue }) {
  const sevClass = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.low;
  return (
    <div className="rounded-xl border border-app-border bg-app-bg/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sevClass}`}>{issue.severity}</span>
        <span className="rounded-full bg-app-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-app-text-muted">{issue.category}</span>
      </div>
      <p className="mt-2.5 border-l-2 border-app-border-emphasis pl-3 text-sm italic text-app-text">“{issue.quote}”</p>
      <p className="mt-2 text-sm text-app-text-muted">{issue.explanation}</p>
      <div className="mt-2 rounded-lg bg-emerald-950/25 border border-emerald-400/20 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Fix</p>
        <p className="mt-0.5 text-sm text-app-text">{issue.suggestedFix}</p>
      </div>
    </div>
  );
}

export function BrandSafetyGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<BrandSafetyState, FormData>(
    checkBrandSafety,
    { status: "idle" },
  );

  const field = "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div>
        <form action={action} className="space-y-5">
          <BrandContextPicker brands={brands} />
          <LanguagePicker />

          <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-4">
            <h3 className="font-semibold">Copy to check</h3>
            <div>
              <label className="text-sm text-app-text-muted">Paste your headline, body, or full ad copy *</label>
              <textarea name="copy" rows={7}
                placeholder="Paste the ad copy, caption, or landing-page text you want reviewed…"
                className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Destination platform</label>
              <select name="platform" defaultValue="" className={`mt-1.5 ${field}`}>
                <option value="">Any / not sure</option>
                <option value="Meta (Facebook/Instagram)">Meta (Facebook/Instagram)</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Email">Email</option>
                <option value="Landing page">Landing page</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Target market</label>
              <input name="market" defaultValue="Morocco / MENA" className={`mt-1.5 ${field}`} />
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
          <div className="rounded-2xl border border-dashed border-app-border p-12 text-center">
            <p className="text-4xl">🛡️</p>
            <p className="mt-4 font-medium text-app-text-muted">Your brand-safety report will appear here</p>
            <p className="mt-1.5 text-sm text-app-text-subtle">Paste copy to get an on-voice + compliance check before you ship.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-app-border bg-app-surface/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-app-text-muted">Reviewing for voice + compliance…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result } = state;
          const v = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.review;
          return (
            <>
              <div className={`rounded-2xl border bg-app-surface/60 p-5 ${v.ring}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Verdict</p>
                    <p className={`mt-1 text-2xl font-bold ${v.text}`}>{v.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Score</p>
                    <p className="mt-1 text-3xl font-bold text-app-text">{result.score}<span className="text-lg text-app-text-subtle">/100</span></p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-app-text leading-relaxed">{result.summary}</p>
              </div>

              {result.issues.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">{result.issues.length} issue{result.issues.length > 1 ? "s" : ""}</p>
                  {result.issues.map((iss, i) => <IssueCard key={i} issue={iss} />)}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-200">
                  No issues flagged — the copy reads clean.
                </div>
              )}

              <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle mb-2">Strengths</p>
                <ul className="space-y-1">
                  {result.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-1.5 text-sm text-app-text"><span className="mt-0.5 text-emerald-400">✓</span>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle mb-2">Revised copy</p>
                <p className="whitespace-pre-wrap text-sm text-app-text leading-relaxed">{result.revisedCopy}</p>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
