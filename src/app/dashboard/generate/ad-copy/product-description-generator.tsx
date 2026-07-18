"use client";

import { useActionState, useState } from "react";
import { generateProductDescription, type ProductDescriptionState } from "./content-actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Writing…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>Generate description</>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-app-text-subtle transition-colors hover:bg-app-surface-2 hover:text-app-text">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ProductDescriptionGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<ProductDescriptionState, FormData>(
    generateProductDescription,
    { status: "idle" },
  );

  const field = "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
      <form action={action} className="space-y-5">
        <BrandContextPicker brands={brands} />
        <LanguagePicker />
        <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-4">
          <h3 className="font-semibold">Product</h3>
          <div>
            <label className="text-sm text-app-text-muted">Product name *</label>
            <input name="productName" placeholder="Argan Glow Serum" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-app-text-muted">Key features / materials</label>
            <textarea name="features" rows={3} placeholder="What it's made of, how it works, what's included" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-app-text-muted">Target audience</label>
            <input name="audience" placeholder="Who this is for" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-app-text-muted">SEO keywords to consider</label>
            <input name="keywords" placeholder="organic argan oil, face serum, moroccan skincare" className={`mt-1.5 ${field}`} />
          </div>
        </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
        )}
        <SubmitButton pending={pending} />
      </form>

      <div className="space-y-4">
        {state.status === "idle" && !pending && (
          <div className="rounded-2xl border border-dashed border-app-border p-8 text-center">
            <p className="text-2xl">📄</p>
            <p className="mt-3 font-medium text-app-text-muted">Your product copy will appear here</p>
          </div>
        )}
        {pending && (
          <div className="rounded-2xl border border-app-border bg-app-surface/60 p-8 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p className="mt-3 text-sm text-app-text-muted">Writing product copy…</p>
          </div>
        )}
        {state.status === "success" && !pending && (
          <>
            <div className="rounded-2xl border border-app-border bg-app-surface">
              <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Short (card)</span>
                <CopyButton text={state.result.short} />
              </div>
              <p className="p-4 text-sm text-app-text">{state.result.short}</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface">
              <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Medium</span>
                <CopyButton text={state.result.medium} />
              </div>
              <p className="p-4 text-sm text-app-text">{state.result.medium}</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface">
              <div className="flex items-center justify-between border-b border-app-border px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Long (SEO)</span>
                <CopyButton text={state.result.long} />
              </div>
              <p className="p-4 text-sm leading-relaxed text-app-text">{state.result.long}</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-app-text-subtle">Bullet points</p>
              <ul className="space-y-1.5">
                {state.result.bulletPoints.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-app-text"><span className="mt-0.5 text-amber-400">•</span>{b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-app-text-subtle">SEO metadata</p>
              <p className="text-xs text-app-text-subtle">Meta title</p>
              <p className="text-sm text-app-text">{state.result.metaTitle}</p>
              <p className="mt-2 text-xs text-app-text-subtle">Meta description</p>
              <p className="text-sm text-app-text">{state.result.metaDescription}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {state.result.seoKeywords.map((k) => <span key={k} className="rounded-full bg-app-surface-2 px-2 py-0.5 text-[11px] text-app-text-muted">{k}</span>)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
