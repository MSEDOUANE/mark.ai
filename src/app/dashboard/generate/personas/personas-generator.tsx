"use client";

import { useActionState, useState } from "react";
import { generatePersonas, type PersonasState, type Persona } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "📸", TikTok: "🎵", Facebook: "👥",
  LinkedIn: "💼", YouTube: "▶️", WhatsApp: "💬", Pinterest: "📌",
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Building personas…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>Generate personas</>
      )}
    </button>
  );
}

const AVATAR_COLORS = [
  "from-violet-500 to-purple-700",
  "from-emerald-500 to-teal-700",
  "from-amber-400 to-orange-600",
  "from-blue-500 to-indigo-700",
];

function PersonaCard({ persona, index, isPrimary }: { persona: Persona; index: number; isPrimary: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const avatarGrad = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <article className={`overflow-hidden rounded-2xl border bg-app-surface transition-shadow hover:shadow-xl hover:shadow-black/30 ${
      isPrimary ? "border-amber-400/40" : "border-app-border"
    }`}>
      {isPrimary && (
        <div className="flex items-center gap-2 bg-amber-400/10 px-5 py-2 text-xs font-semibold text-amber-400">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
          Primary audience — focus your spend here
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {/* Avatar initials */}
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGrad} text-xl font-black text-white shadow-lg`}>
          {persona.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold">{persona.name}</h3>
            <span className="rounded-full bg-app-surface-2 px-2.5 py-0.5 text-xs text-app-text-muted">
              {persona.age} · {persona.occupation}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-app-text-muted">{persona.location} · {persona.income}</p>
          {/* Platforms */}
          <div className="mt-2 flex flex-wrap gap-1">
            {persona.preferredPlatforms.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-full bg-app-surface-2 px-2 py-0.5 text-[11px] text-app-text-muted">
                {PLATFORM_ICONS[p] ?? ""} {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quote */}
      <div className="mx-5 mb-4 rounded-xl bg-app-surface-2/50 px-4 py-3">
        <p className="text-sm italic text-app-text">&ldquo;{persona.quote}&rdquo;</p>
      </div>

      {/* Ad hook */}
      <div className="mx-5 mb-4 rounded-xl border border-amber-400/20 bg-amber-950/20 px-4 py-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-500">Example ad hook</p>
        <p className="text-sm font-medium text-amber-100">{persona.exampleHook}</p>
      </div>

      {/* Expand button */}
      <button type="button" onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between border-t border-app-border px-5 py-3 text-xs font-medium text-app-text-subtle hover:text-app-text">
        {expanded ? "Show less" : "Show full profile"}
        <svg className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-app-border p-5 sm:grid-cols-2">
          <Section title="Goals" items={persona.goals} color="text-emerald-400" />
          <Section title="Pain points" items={persona.painPoints} color="text-red-400" />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-app-text-subtle">Core motivation</p>
            <p className="text-sm text-app-text">{persona.motivations}</p>
          </div>
          <Section title="Messaging angles" items={persona.messagingAngles} color="text-violet-400" />
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-app-text-subtle">Ad receptiveness</p>
            <p className="text-sm text-app-text">{persona.adReceptiveness}</p>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-blue-400/20 bg-blue-950/20 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              Meta Ads targeting spec
            </p>
            <p className="text-sm text-app-text">
              Ages {persona.metaTargeting.ageMin}–{persona.metaTargeting.ageMax} ·{" "}
              {persona.metaTargeting.genders.join(", ")} ·{" "}
              {persona.metaTargeting.placements.join(", ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {persona.metaTargeting.interests.map((i) => (
                <span key={i} className="rounded-full bg-blue-900/30 px-2 py-0.5 text-[11px] text-blue-300">{i}</span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {persona.metaTargeting.detailedTargeting.map((d) => (
                <span key={d} className="rounded-full bg-app-surface-2 px-2 py-0.5 text-[11px] text-app-text-muted">{d}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-app-text-subtle">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-1.5 text-sm text-app-text`}>
            <span className={`mt-0.5 ${color}`}>•</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonasGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<PersonasState, FormData>(
    generatePersonas,
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
            <h3 className="font-semibold">About your product</h3>

            <div>
              <label className="text-sm text-app-text-muted">Product / brand name *</label>
              <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Product description</label>
              <textarea name="description" rows={3}
                placeholder="What it is, what it does, what makes it special"
                className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Target market / geography</label>
              <input name="market" placeholder="Morocco, urban areas, mid-to-high income"
                className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Price point</label>
              <input name="pricePoint" placeholder="800–3 000 MAD" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-app-text-muted">Any existing audience knowledge</label>
              <textarea name="audience" rows={2}
                placeholder="What you already know about your customers"
                className={`mt-1.5 ${field}`} />
            </div>
          </div>

          {state.status === "error" && (
            <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
              {state.message}
            </p>
          )}

          <SubmitButton pending={pending} />
        </form>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {state.status === "idle" && !pending && (
          <div className="rounded-2xl border border-dashed border-app-border p-12 text-center">
            <p className="text-4xl">👥</p>
            <p className="mt-4 font-medium text-app-text-muted">Your buyer personas will appear here</p>
            <p className="mt-1.5 text-sm text-app-text-subtle">Fill in the product brief to get 3–4 vivid personas with ad hooks.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-app-border bg-app-surface/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-app-text-muted">Building personas from your brief…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result, productName } = state;
          const primaryName = result.recommendedPrimary.split(" ")[0];
          return (
            <>
              {/* Summary strip */}
              <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-app-text-subtle mb-2">Audience summary for {productName}</p>
                <p className="text-sm text-app-text leading-relaxed">{result.audienceSummary}</p>
                <div className="mt-3 rounded-xl bg-amber-950/30 border border-amber-400/20 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Universal pain point</p>
                  <p className="text-sm text-app-text">{result.sharedPainPoint}</p>
                </div>
              </div>

              {/* Persona cards */}
              {result.personas.map((p, i) => (
                <PersonaCard
                  key={i}
                  persona={p}
                  index={i}
                  isPrimary={p.name.split(" ")[0] === primaryName}
                />
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}
