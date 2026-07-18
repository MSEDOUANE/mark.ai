"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateCreative, applyScoreTips } from "@/app/dashboard/creatives/actions";

type Size = "portrait" | "square" | "story" | "link" | "landscape";

const SIZES: { key: Size; label: string; aspect: string; w: number; h: number }[] = [
  { key: "portrait",  label: "4:5",   aspect: "aspect-[4/5]",   w: 4,  h: 5  },
  { key: "square",    label: "1:1",   aspect: "aspect-square",  w: 1,  h: 1  },
  { key: "story",     label: "9:16",  aspect: "aspect-[9/16]",  w: 9,  h: 16 },
  { key: "link",      label: "Link",  aspect: "aspect-[1.91/1]", w: 19, h: 10 },
  { key: "landscape", label: "16:9",  aspect: "aspect-video",   w: 16, h: 9  },
];

interface CreativeCardProps {
  id: string;
  type: string;
  status: string;
  template: string | null | undefined;
  headline: string | null | undefined;
  primaryText: string | null | undefined;
  score: number | null | undefined;
  scoreRationale: string | null | undefined;
  scoreTips: string[] | null | undefined;
  statusLabel: string;
  /** First chars of assetUrl — changes when fal.ai generates a new background, busts the 1-hour render cache. */
  assetVersion?: string | null;
  /** Full asset URL — needed for video creatives (the clip plays directly). */
  assetUrl?: string | null;
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius  = 15.9;
  const circ    = 2 * Math.PI * radius;
  const fill    = (score / 100) * circ;
  const color   = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const bg      = score >= 80 ? "rgba(16,185,129,0.15)" : score >= 60 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)";

  return (
    <div className="relative flex h-11 w-11 items-center justify-center rounded-full"
      style={{ background: bg }}>
      <svg viewBox="0 0 36 36" className="-rotate-90 absolute inset-0 h-full w-full">
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="2.5"
          stroke="rgba(255,255,255,0.1)" />
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="2.5"
          stroke={color} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} />
      </svg>
      <span className="relative text-xs font-bold leading-none" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ── Status pulse ──────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
    );
  }
  if (status === "failed") {
    return <span className="flex h-2 w-2 rounded-full bg-red-400" />;
  }
  // pending / generating
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
    </span>
  );
}

export function CreativeCard({
  id,
  type,
  status,
  template,
  headline,
  primaryText,
  score,
  scoreRationale,
  scoreTips,
  statusLabel,
  assetVersion,
  assetUrl,
}: CreativeCardProps) {
  const [size,         setSize]      = useState<Size>("portrait");
  const [showTips,     setShowTips]  = useState(false);
  const [imageModel,   setImageModel] = useState<"nano-banana-2" | "flux-schnell">("nano-banana-2");
  const [isPending,    startTransition]      = useTransition();
  const [isPhoPending, startPhoTransition]   = useTransition();
  const [isApplying,   startApplyTransition] = useTransition();
  const router = useRouter();

  const current     = SIZES.find((s) => s.key === size)!;
  // `v` changes whenever the background image changes — forces the browser to
  // bypass its 1-hour render cache and fetch the newly generated version.
  const v           = assetVersion ?? "0";
  const previewUrl  = `/api/creatives/${id}?size=${size}&thumb=1&v=${v}`;
  const downloadUrl = `/api/creatives/${id}?size=${size}&download=1`;
  const isGenerating = status === "pending" || status === "generating";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/8 bg-app-surface transition-shadow hover:shadow-2xl hover:shadow-black/50">

      {/* ── Image area ────────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden bg-app-bg ${current.aspect}`}>

        {/* Generating spinner */}
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-pulse bg-gradient-to-br from-zinc-800 to-zinc-900">
            <svg className="h-7 w-7 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-xs text-app-text-subtle">Generating…</p>
          </div>
        )}

        {/* Failed state */}
        {status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app-surface">
            <svg className="h-8 w-8 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <p className="text-xs text-red-400/80">Generation failed</p>
          </div>
        )}

        {/* Ready: video creatives play the clip; image creatives show the designed render */}
        {status === "ready" && type === "video" && assetUrl ? (
          <>
            <video key={assetUrl} src={assetUrl} controls loop muted playsInline
              className="h-full w-full object-contain" />
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              ▶ Video
            </span>
          </>
        ) : status === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={previewUrl} src={previewUrl} alt={headline ?? "ad creative"}
            className="h-full w-full object-contain" />
        ) : null}

        {/* Score ring — top-right overlay */}
        {typeof score === "number" && (
          <div className="absolute right-2.5 top-2.5 drop-shadow-lg">
            <ScoreRing score={score} />
          </div>
        )}

        {/* Hover action overlay */}
        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent p-3
          opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex gap-1.5">
            {/* Download */}
            <a href={downloadUrl} download title="Download this size"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
            {/* Download all sizes (zip) */}
            {status === "ready" && type !== "video" && (
              <a href={`/api/creatives/${id}/zip`} download title="Download all sizes (.zip)"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </a>
            )}
            {/* Regenerate (AI variation) */}
            <button
              type="button"
              title={`Regenerate with ${imageModel === "nano-banana-2" ? "Nano Banana 2" : "FLUX Schnell"}`}
              disabled={isPending || isPhoPending}
              onClick={() => {
                const fd = new FormData();
                fd.append("id", id);
                fd.append("imageModel", imageModel);
                startTransition(async () => {
                  await regenerateCreative(fd);
                  router.refresh();
                });
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            {/* Use original product photo — avoids AI text garbling */}
            <button
              type="button"
              title="Use original product photo"
              disabled={isPending || isPhoPending}
              onClick={() => {
                const fd = new FormData();
                fd.append("id", id);
                fd.append("useOriginalPhoto", "1");
                startPhoTransition(async () => {
                  await regenerateCreative(fd);
                  router.refresh();
                });
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
            >
              {isPhoPending ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              )}
            </button>
          </div>
          {/* Template badge */}
          {template && template !== "auto" && (
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium capitalize text-white/80 backdrop-blur-sm">
              {template}
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2.5">
        {/* Size pills */}
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button key={s.key} type="button" onClick={() => setSize(s.key)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                size === s.key ? "bg-amber-400 text-zinc-950" : "text-app-text-subtle hover:text-app-text"
              }`}>
              {s.label}
            </button>
          ))}
          {/* Status dot */}
          <div className="ml-auto flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-[11px] text-app-text-subtle capitalize">{statusLabel}</span>
          </div>
        </div>

        {/* Model toggle — shown only on ready/failed cards (not while generating) */}
        {!isGenerating && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] text-app-text-subtle">Model:</span>
            {(["nano-banana-2", "flux-schnell"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setImageModel(m)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  imageModel === m ? "bg-app-surface-2 text-app-text" : "text-app-text-subtle hover:text-app-text-muted"
                }`}>
                {m === "nano-banana-2" ? "NanoBanana" : "FLUX"}
              </button>
            ))}
          </div>
        )}

        {/* Headline */}
        {headline ? (
          <p className="mt-2 truncate text-sm font-semibold text-app-text">{headline}</p>
        ) : null}
        {primaryText ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-app-text-subtle">{primaryText}</p>
        ) : null}

        {/* Score detail (expandable) */}
        {typeof score === "number" && (scoreRationale || (scoreTips && scoreTips.length > 0)) ? (
          <div className="mt-2.5 border-t border-white/8 pt-2.5">
            <button type="button" onClick={() => setShowTips((p) => !p)}
              className="flex w-full items-center justify-between text-left">
              <span className="text-xs text-app-text-subtle">AI conversion score</span>
              <svg className={`h-3.5 w-3.5 text-app-text-subtle transition-transform ${showTips ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTips && (
              <div className="mt-2 space-y-1.5">
                {scoreRationale ? (
                  <p className="text-xs text-app-text-muted">{scoreRationale}</p>
                ) : null}
                {scoreTips && scoreTips.length > 0 ? (
                  <>
                    <ul className="space-y-1">
                      {scoreTips.map((t, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-app-text-subtle">
                          <svg className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {t}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={isApplying || isPending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.append("id", id);
                        startApplyTransition(async () => {
                          await applyScoreTips(fd);
                          router.refresh();
                        });
                      }}
                      className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
                    >
                      {isApplying ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Applying…
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          Apply recommendations
                        </>
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
