"use client";

import { useActionState } from "react";
import { generateEmail, type EmailState, type EmailStep } from "./actions";
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
        </svg>Write emails</>
      )}
    </button>
  );
}

function EmailCard({ email, single }: { email: EmailStep; single: boolean }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {!single && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-zinc-950">{email.step}</span>
        )}
        <h3 className="font-bold">{email.purpose}</h3>
        <span className="ml-auto rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">{email.timing}</span>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Subject options</p>
        <ul className="space-y-1">
          {email.subjectOptions.map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-sm text-zinc-200"><span className="mt-0.5 text-amber-400">✉</span>{s}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-zinc-500">Preheader: <span className="text-zinc-400">{email.preheader}</span></p>

      <div className="mt-3 rounded-xl bg-zinc-950/60 border border-zinc-800 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{email.body}</p>
      </div>

      <div className="mt-3">
        <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300">{email.cta}</span>
      </div>
    </article>
  );
}

export function EmailGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(
    generateEmail,
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
            <h3 className="font-semibold">Email brief</h3>
            <div>
              <label className="text-sm text-zinc-400">Product / brand name *</label>
              <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Email type</label>
              <select name="emailType" defaultValue="single" className={`mt-1.5 ${field}`}>
                <option value="single">Single promotional email</option>
                <option value="welcome">Welcome sequence (3)</option>
                <option value="abandoned-cart">Abandoned-cart recovery (3)</option>
                <option value="launch">Product launch sequence</option>
                <option value="reengagement">Win-back / re-engagement</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Product description</label>
              <textarea name="description" rows={3} placeholder="What it is, who it's for" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Audience</label>
              <input name="audience" placeholder="Existing customers, home decor lovers" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Offer / angle</label>
              <input name="offer" placeholder="20% off this week, new collection…" className={`mt-1.5 ${field}`} />
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
            <p className="text-4xl">✉️</p>
            <p className="mt-4 font-medium text-zinc-400">Your emails will appear here</p>
            <p className="mt-1.5 text-sm text-zinc-600">Pick an email type and describe the offer to get ready-to-send copy.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-zinc-400">Writing your emails…</p>
          </div>
        )}

        {state.status === "success" && !pending && (() => {
          const { result, productName } = state;
          const single = result.emails.length === 1;
          return (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  {single ? "Email" : `${result.emails.length}-email sequence`} for {productName}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">{result.strategy}</p>
              </div>

              {result.emails.map((e, i) => <EmailCard key={i} email={e} single={single} />)}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Tips</p>
                <ul className="space-y-1">
                  {result.tips.map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-sm text-zinc-300"><span className="mt-0.5 text-amber-400">•</span>{t}</li>
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
