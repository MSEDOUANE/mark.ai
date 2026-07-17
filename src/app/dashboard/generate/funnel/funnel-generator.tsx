"use client";

import { useActionState } from "react";
import { generateFunnel, type FunnelState, type FunnelStage } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const STAGE_STYLE: Record<string, { ring: string; dot: string; tint: string }> = {
  TOFU: { ring: "border-sky-500/30", dot: "bg-sky-400", tint: "text-sky-300" },
  MOFU: { ring: "border-violet-500/30", dot: "bg-violet-400", tint: "text-violet-300" },
  BOFU: { ring: "border-emerald-500/30", dot: "bg-emerald-400", tint: "text-emerald-300" },
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Designing funnel…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5m-15 5.25h13.5m-11.25 5.25h9m-6.75 5.25h4.5"/>
        </svg>Design funnel</>
      )}
    </button>
  );
}

function StageCard({ stage, index }: { stage: FunnelStage; index: number }) {
  const s = STAGE_STYLE[stage.stage] ?? STAGE_STYLE.TOFU;
  return (
    <article className={`rounded-2xl border bg-zinc-900 p-5 ${s.ring}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${s.dot} text-sm font-bold text-zinc-950`}>{index + 1}</div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${s.tint}`}>{stage.stage}</p>
          <h3 className="text-lg font-bold leading-tight">{stage.label}</h3>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-300">{stage.objective}</p>
      <p className="mt-1.5 text-xs text-zinc-500">Audience: {stage.audienceState}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Angles</p>
          <ul className="space-y-1">
            {stage.messagingAngles.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-sm text-zinc-300"><span className={`mt-0.5 ${s.tint}`}>•</span>{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Formats</p>
          <div className="flex flex-wrap gap-1.5">
            {stage.adFormats.map((f) => (
              <span key={f} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300">{f}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-950/60 border border-zinc-800 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Sample hook</p>
        <p className="mt-1 text-sm text-zinc-200">{stage.sampleHook}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-400/15 px-2.5 py-1 font-semibold text-amber-300">CTA: {stage.cta}</span>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-400">KPI: {stage.primaryKpi}</span>
      </div>
    </article>
  );
}

export function FunnelGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<FunnelState, FormData>(
    generateFunnel,
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
            <h3 className="font-semibold">Funnel brief</h3>
            <div>
              <label className="text-sm text-zinc-400">Product / brand name *</label>
              <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Product description</label>
              <textarea name="description" rows={3} placeholder="What it is, who it's for" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Target audience</label>
              <input name="audience" placeholder="Women 25–45 in Morocco, home decor lovers" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Campaign goal</label>
              <input name="goal" placeholder="Drive online sales" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Primary market</label>
              <input name="market" defaultValue="Morocco / MENA" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Conversion destination</label>
              <select name="destination" defaultValue="" className={`mt-1.5 ${field}`}>
                <option value="">Not sure</option>
                <option value="website">Website / online store</option>
                <option value="whatsapp">WhatsApp (COD-friendly)</option>
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
            <p className="text-4xl">🫙</p>
            <p className="mt-4 font-medium text-zinc-400">Your TOFU → MOFU → BOFU funnel will appear here</p>
            <p className="mt-1.5 text-sm text-zinc-600">Describe the product to get a staged awareness → consideration → conversion plan.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-zinc-400">Designing your full funnel…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result, productName } = state;
          return (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Funnel strategy for {productName}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{result.overview}</p>
                <div className="mt-3 rounded-xl bg-amber-950/25 border border-amber-400/20 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Budget split</p>
                  <p className="text-sm text-zinc-200">{result.budgetSplit}</p>
                </div>
              </div>

              {result.stages.map((s, i) => <StageCard key={i} stage={s} index={i} />)}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Local conversion playbook</p>
                <ul className="space-y-1.5">
                  {result.localPlaybook.map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-sm text-zinc-300"><span className="mt-0.5 text-emerald-400">→</span>{t}</li>
                  ))}
                </ul>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
