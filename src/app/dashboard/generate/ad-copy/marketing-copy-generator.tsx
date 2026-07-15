"use client";

import { useActionState, useState } from "react";
import { generateMarketingCopy, type MarketingCopyState } from "./content-actions";
import { MARKETING_FORMATS } from "./marketing-formats";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";

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
        </svg>Generate copy</>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function MarketingCopyGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<MarketingCopyState, FormData>(
    generateMarketingCopy,
    { status: "idle" },
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["Email", "Landing Hero"]);

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  function toggleFormat(id: string) {
    setSelectedFormats((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
      <form action={action} className="space-y-5">
        {selectedFormats.map((f) => <input key={f} type="hidden" name="formats" value={f} />)}
        <BrandContextPicker brands={brands} />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="font-semibold">Product / campaign</h3>
          <div>
            <label className="text-sm text-zinc-400">Name *</label>
            <input name="productName" placeholder="Summer Sale" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Goal</label>
            <input name="goal" placeholder="Drive sign-ups, announce a sale…" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Offer / promotion</label>
            <input name="offer" placeholder="20% off, free shipping…" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Audience</label>
            <input name="audience" placeholder="Who is this for" className={`mt-1.5 ${field}`} />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h3 className="font-semibold">Formats</h3>
          <p className="mt-0.5 text-sm text-zinc-400">Select one or more — each gets its own piece.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {MARKETING_FORMATS.map((f) => {
              const on = selectedFormats.includes(f.id);
              return (
                <button key={f.id} type="button" onClick={() => toggleFormat(f.id)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all ${
                    on ? "border-amber-400/50 bg-amber-950/25 ring-1 ring-amber-400" : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                  }`}>
                  <span className={`text-sm font-semibold ${on ? "text-amber-200" : "text-zinc-300"}`}>{f.label}</span>
                  <span className="text-[10px] text-zinc-500">{f.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
        )}
        <SubmitButton pending={pending} />
      </form>

      <div className="space-y-4">
        {state.status === "idle" && !pending && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-2xl">📣</p>
            <p className="mt-3 font-medium text-zinc-400">Your marketing copy will appear here</p>
          </div>
        )}
        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p className="mt-3 text-sm text-zinc-400">Writing {selectedFormats.length} piece{selectedFormats.length !== 1 ? "s" : ""}…</p>
          </div>
        )}
        {state.status === "success" && !pending && state.result.pieces.map((p, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
              <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">{p.format}</span>
              <CopyButton text={[p.headline, p.body].filter(Boolean).join("\n\n")} />
            </div>
            <div className="space-y-2 p-4">
              {p.headline && <p className="text-base font-bold text-zinc-100">{p.headline}</p>}
              <p className="text-sm leading-relaxed text-zinc-300">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
