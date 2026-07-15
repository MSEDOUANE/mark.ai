"use client";

import { useActionState, useState } from "react";
import { generateSocialCaptions, type SocialCaptionsState, type CaptionVariant } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

const PLATFORMS = [
  { id: "Instagram", icon: "📸", color: "from-pink-500 to-orange-500" },
  { id: "TikTok",    icon: "🎵", color: "from-zinc-900 to-zinc-700" },
  { id: "Facebook",  icon: "👥", color: "from-blue-600 to-blue-800" },
  { id: "LinkedIn",  icon: "💼", color: "from-blue-500 to-blue-700" },
  { id: "X",         icon: "𝕏",  color: "from-zinc-800 to-zinc-900" },
  { id: "Pinterest", icon: "📌", color: "from-red-600 to-red-800" },
] as const;

const TONES = ["Authentic", "Inspirational", "Funny", "Educational", "Urgent", "Luxurious"];

const ANGLE_COLORS: Record<string, string> = {
  "Benefit-led":       "bg-emerald-500/15 text-emerald-300",
  "Story-driven":      "bg-violet-500/15 text-violet-300",
  "Behind the scenes": "bg-amber-500/15 text-amber-300",
  "Question-based":    "bg-blue-500/15 text-blue-300",
  "Social proof":      "bg-pink-500/15 text-pink-300",
  "FOMO":              "bg-red-500/15 text-red-300",
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Writing captions…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>Generate captions</>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button type="button" onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200">
      {copied
        ? <><svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied</>
        : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.637c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>Copy</>
      }
    </button>
  );
}

function CaptionCard({ v, platform }: { v: CaptionVariant; platform: string }) {
  const angleClass = Object.entries(ANGLE_COLORS).find(([k]) =>
    v.angle.toLowerCase().includes(k.toLowerCase()),
  )?.[1] ?? "bg-zinc-700/30 text-zinc-400";

  const fullText = `${v.emojiLine} ${v.caption}\n\n${v.hashtags.map((h) => `#${h}`).join(" ")}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-shadow hover:shadow-xl hover:shadow-black/30">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${angleClass}`}>
          {v.angle}
        </span>
        <CopyButton text={fullText} />
      </div>

      <div className="p-5 space-y-3">
        {/* Emoji + caption */}
        <div>
          <p className="text-lg">{v.emojiLine}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-200 whitespace-pre-line">{v.caption}</p>
        </div>

        {/* Hashtags */}
        {v.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 pt-3">
            {v.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-blue-400">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function SocialCaptionsGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [state, action, pending] = useActionState<SocialCaptionsState, FormData>(
    generateSocialCaptions,
    { status: "idle" },
  );

  const [platform, setPlatform] = useState("Instagram");

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form action={action} className="space-y-5">
        <input type="hidden" name="platform" value={platform} />

        <BrandContextPicker brands={brands} />
        <LanguagePicker />

        {/* Platform picker */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h3 className="mb-3 font-semibold">Platform</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-center transition-all ${
                  platform === p.id
                    ? "border-amber-400/50 bg-amber-950/30 text-amber-300"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}>
                <span className="text-xl">{p.icon}</span>
                <span className="text-[11px] font-medium">{p.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product details */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="font-semibold">Content brief</h3>

          <div>
            <label className="text-sm text-zinc-400">Product / brand name *</label>
            <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Description</label>
            <textarea name="description" rows={2} placeholder="What makes this worth posting about?"
              className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Key message / offer</label>
            <input name="keyMessage" placeholder="Summer sale — 25% off all handwoven pieces" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Target audience</label>
            <input name="audience" placeholder="Home décor enthusiasts in Morocco" className={`mt-1.5 ${field}`} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Tone</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TONES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1 text-xs has-[:checked]:border-amber-400/50 has-[:checked]:bg-amber-950/30 has-[:checked]:text-amber-300">
                  <input type="radio" name="tone" value={t} className="sr-only" defaultChecked={t === "Authentic"} />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
        )}

        <SubmitButton pending={pending} />
      </form>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {state.status === "idle" && !pending && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-3xl">💬</p>
            <p className="mt-3 font-medium text-zinc-400">Captions will appear here</p>
            <p className="mt-1 text-sm text-zinc-600">Pick a platform and fill the brief.</p>
          </div>
        )}

        {pending && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="mt-3 text-sm text-zinc-400">Writing {platform} captions…</p>
          </div>
        )}

        {state.status === "success" && !pending && (
          <>
            <div className="flex items-center gap-3">
              <p className="font-semibold">
                {state.result.variants.length} captions for{" "}
                <span className="text-amber-400">{state.productName}</span>
              </p>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                {state.platform}
              </span>
            </div>

            {state.result.variants.map((v, i) => (
              <CaptionCard key={i} v={v} platform={state.platform} />
            ))}

            {/* Platform tips */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <p className="mb-2 text-sm font-semibold text-zinc-300">
                {state.platform} tips
              </p>
              <ul className="space-y-1.5">
                {state.result.platformTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="mt-0.5 text-amber-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-600">
                Best time to post: {state.result.bestPostingTimes}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
