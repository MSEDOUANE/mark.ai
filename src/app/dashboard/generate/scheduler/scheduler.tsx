"use client";

import { useActionState, useState } from "react";
import { planContent, schedulePost, cancelScheduledPost, type PlannerState, type PostIdea } from "./actions";
import { BrandContextPicker, type BrandContextOption } from "@/components/brand-context-picker";
import { LanguagePicker } from "@/components/language-picker";

export interface QueueItem {
  id: string;
  caption: string;
  imageUrl: string | null;
  status: string;
  scheduledFor: string;
  permalink: string | null;
  error: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  draft: "bg-zinc-700/40 text-zinc-400 border-zinc-600",
  publishing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  canceled: "bg-zinc-800 text-zinc-500 border-zinc-700",
};

function PlanButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Planning…</>
      ) : (
        <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6"/>
        </svg>Plan posts</>
      )}
    </button>
  );
}

function IdeaCard({ idea, onUse }: { idea: PostIdea; onUse: (caption: string) => void }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{idea.theme}</h3>
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">{idea.format}</span>
        <span className="ml-auto text-xs text-zinc-500">{idea.suggestedDay} · {idea.bestTime}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{idea.caption}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {idea.hashtags.map((h) => (
          <span key={h} className="rounded-full bg-blue-900/40 px-2 py-0.5 text-[11px] text-blue-300">
            {h.startsWith("#") ? h : `#${h}`}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{idea.rationale}</p>
      <button
        type="button"
        onClick={() => onUse(`${idea.caption}\n\n${idea.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`)}
        className="mt-3 rounded-full border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-950/30"
      >
        Use this caption →
      </button>
    </article>
  );
}

export function Scheduler({
  brands = [],
  queue = [],
  hasConnection = false,
  info,
  error,
}: {
  brands?: BrandContextOption[];
  queue?: QueueItem[];
  hasConnection?: boolean;
  info?: string;
  error?: string;
}) {
  const [state, action, pending] = useActionState<PlannerState, FormData>(planContent, { status: "idle" });
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  const active = queue.filter((q) => q.status === "scheduled" || q.status === "draft" || q.status === "publishing");
  const history = queue.filter((q) => q.status === "published" || q.status === "failed" || q.status === "canceled");

  return (
    <div className="space-y-8">
      {!hasConnection && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          No Meta Page connection detected. You can still plan and queue posts — they’ll publish automatically once a Page
          with <code className="text-amber-200">pages_manage_posts</code> is connected in Settings.
        </div>
      )}
      {info && <div className="rounded-xl border border-emerald-400/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{info}</div>}
      {error && <div className="rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        {/* ── Planner + schedule form ─────────────────────────────────────── */}
        <div className="space-y-5">
          <form action={action} className="space-y-5">
            <BrandContextPicker brands={brands} />
            <LanguagePicker />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
              <h3 className="font-semibold">Plan content</h3>
              <div>
                <label className="text-sm text-zinc-400">Product / brand name *</label>
                <input name="productName" placeholder="NooRattan" className={`mt-1.5 ${field}`} />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Description</label>
                <textarea name="description" rows={2} placeholder="What it is, who it's for" className={`mt-1.5 ${field}`} />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Content goal</label>
                <input name="goal" placeholder="Grow engagement, drive DMs…" className={`mt-1.5 ${field}`} />
              </div>
              <div>
                <label className="text-sm text-zinc-400">How many posts</label>
                <input name="count" type="number" min={3} max={8} defaultValue={5} className={`mt-1.5 ${field}`} />
              </div>
            </div>
            <PlanButton pending={pending} />
          </form>

          {/* Schedule a post */}
          <form action={schedulePost} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="font-semibold">Queue a post</h3>
            <div>
              <label className="text-sm text-zinc-400">Caption *</label>
              <textarea name="caption" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)}
                placeholder="Write or paste a caption, or click “Use this caption” on a planned idea." className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Image URL (optional)</label>
              <input name="imageUrl" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/photo.jpg" className={`mt-1.5 ${field}`} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Publish at</label>
              <input name="scheduledFor" type="datetime-local" className={`mt-1.5 ${field}`} />
            </div>
            <div className="flex gap-2">
              <button type="submit" name="mode" value="schedule"
                className="flex-1 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
                Schedule
              </button>
              <button type="submit" name="mode" value="draft"
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
                Save draft
              </button>
            </div>
          </form>
        </div>

        {/* ── Ideas + queue ───────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Queue */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Queue</h2>
            {active.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-600">
                Nothing queued yet. Plan posts, then schedule the ones you like.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {active.map((q) => (
                  <div key={q.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[q.status] ?? STATUS_STYLE.draft}`}>{q.status}</span>
                        <span className="text-xs text-zinc-500">{q.status === "draft" ? "no time set" : new Date(q.scheduledFor).toLocaleString()}</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm text-zinc-200">{q.caption}</p>
                    </div>
                    <form action={cancelScheduledPost}>
                      <input type="hidden" name="id" value={q.id} />
                      <button className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800">Cancel</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Planned ideas */}
          {state.status === "error" && (
            <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
          )}
          {state.status === "success" && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Planned ideas</h2>
              <p className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">{state.result.strategy}</p>
              <div className="mt-3 space-y-3">
                {state.result.ideas.map((idea, i) => <IdeaCard key={i} idea={idea} onUse={setCaption} />)}
              </div>
            </section>
          )}

          {/* History */}
          {history.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">History</h2>
              <div className="mt-3 space-y-2">
                {history.map((q) => (
                  <div key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[q.status] ?? STATUS_STYLE.draft}`}>{q.status}</span>
                      <span className="text-xs text-zinc-500">{new Date(q.scheduledFor).toLocaleString()}</span>
                      {q.permalink && <a href={q.permalink} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-amber-300 hover:text-amber-200">View post →</a>}
                    </div>
                    <p className="mt-1.5 truncate text-sm text-zinc-300">{q.caption}</p>
                    {q.error && <p className="mt-1 text-xs text-red-300">{q.error}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
