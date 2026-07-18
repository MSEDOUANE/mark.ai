"use client";

import { useState } from "react";
import Link from "next/link";

interface WebsiteReport {
  url: string;
  brandName: string;
  valueProposition: string;
  targetAudience: string;
  toneOfVoice: string;
  keyMessages: string[];
  currentOffers: string[];
  strengths: string[];
  weaknesses: string[];
  suggestedAdAngles: string[];
}

export function WebsiteAnalysisClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WebsiteReport | null>(null);

  async function handleAnalyze() {
    const raw = url.trim();
    if (!raw) return;
    setLoading(true); setError(null); setReport(null);
    try {
      const target = raw.startsWith("http") ? raw : `https://${raw}`;
      const res = await fetch(`/api/website-analysis?url=${encodeURIComponent(target)}`);
      const data = (await res.json()) as WebsiteReport & { error?: string };
      if (!res.ok || "error" in data) throw new Error((data as { error?: string }).error ?? "Analysis failed");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const campaignHref = report
    ? `/dashboard/campaigns/new?${new URLSearchParams({
        productName: report.brandName,
        description: report.valueProposition,
        websiteUrl: report.url,
      }).toString()}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAnalyze(); } }}
          placeholder="yoursite.com"
          className="min-w-0 flex-1 rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500"
        />
        <button type="button" onClick={() => void handleAnalyze()} disabled={loading || !url.trim()}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
          {loading ? (
            <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analyzing…</>
          ) : "Analyze"}
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</p>}

      {!report && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-app-border p-12 text-center">
          <p className="text-4xl">🌐</p>
          <p className="mt-4 font-medium text-app-text-muted">Paste a website URL to audit its messaging</p>
          <p className="mt-1.5 text-sm text-app-text-subtle">Get value prop, offers, gaps, and suggested ad angles.</p>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-app-border bg-app-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{report.brandName}</h2>
                <p className="mt-1 text-sm text-app-text">{report.valueProposition}</p>
              </div>
              {campaignHref && (
                <Link href={campaignHref}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
                  Start a campaign for this →
                </Link>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-text-subtle">
              <span className="rounded-full bg-app-surface-2 px-2.5 py-1">Audience: {report.targetAudience}</span>
              <span className="rounded-full bg-app-surface-2 px-2.5 py-1">Tone: {report.toneOfVoice}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Key messages</p>
              <ul className="mt-2 space-y-1.5">
                {report.keyMessages.map((m, i) => <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-blue-400">•</span>{m}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Current offers</p>
              {report.currentOffers.length ? (
                <ul className="mt-2 space-y-1.5">
                  {report.currentOffers.map((o, i) => <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-amber-400">•</span>{o}</li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-app-text-subtle">No active offers found.</p>}
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Strengths</p>
              <ul className="mt-2 space-y-1.5">
                {report.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-emerald-400">•</span>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Weaknesses</p>
              <ul className="mt-2 space-y-1.5">
                {report.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-red-400">•</span>{w}</li>)}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-950/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Suggested ad angles</p>
            <ul className="mt-2 space-y-1.5">
              {report.suggestedAdAngles.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-amber-400">•</span>{a}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
