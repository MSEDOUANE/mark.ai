"use client";

import { useState } from "react";

export type TrendPoint = { date: string; value: number };
export type TrendFormat = "number" | "money" | "percent" | "ratio";

function formatValue(v: number, f: TrendFormat, currency: string): string {
  if (f === "money") return `${(v / 100).toFixed(2)} ${currency}`;
  if (f === "percent") return `${v.toFixed(2)}%`;
  if (f === "ratio") return v.toFixed(2);
  // Pin the locale — a bare toLocaleString() differs between the server (comma)
  // and a non-US browser (space), causing a hydration mismatch.
  return Math.round(v).toLocaleString("en-US");
}

/**
 * Tiny static sparkline for inline use in tables (one entity's trend over time).
 * No card, label, axes or hover — just the line.
 */
export function Sparkline({
  points,
  color = "#fbbf24",
}: {
  points: TrendPoint[];
  color?: string;
}) {
  const W = 110;
  const H = 28;
  const padY = 3;
  const n = points.length;
  if (n === 0) {
    return <span className="text-[10px] text-zinc-600">—</span>;
  }
  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const xAt = (i: number) => (n <= 1 ? W / 2 : (i * W) / (n - 1));
  const yAt = (v: number) => H - padY - ((v - min) / span) * (H - 2 * padY);
  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-6 w-[90px]"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Self-contained SVG sparkline (line + area) for one metric over time, with a
 * hover tooltip. No charting dependency — keeps the bundle small and avoids
 * React-19/Next-16 compatibility surprises.
 */
export function TrendChart({
  label,
  points,
  color = "#34d399",
  format = "number",
  currency = "",
}: {
  label: string;
  points: TrendPoint[];
  color?: string;
  format?: TrendFormat;
  currency?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 300;
  const H = 110;
  const padX = 6;
  const padY = 10;
  const n = points.length;
  const gid = "grad-" + label.replace(/[^a-z0-9]/gi, "");

  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  const xAt = (i: number) =>
    n <= 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
  const yAt = (v: number) => H - padY - ((v - min) / span) * (H - 2 * padY);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`)
    .join(" ");
  const area =
    n > 0
      ? `${line} L${xAt(n - 1).toFixed(1)},${H - padY} L${xAt(0).toFixed(1)},${H - padY} Z`
      : "";

  const latest = points[n - 1]?.value ?? 0;
  const active = hover != null ? points[hover] : null;
  const shortDate = (d: string) => (d.length >= 10 ? d.slice(5) : d);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="text-sm font-semibold text-zinc-100">
          {formatValue(active ? active.value : latest, format, currency)}
        </span>
      </div>

      {n === 0 ? (
        <div className="mt-2 flex h-[88px] items-center justify-center text-xs text-zinc-600">
          no data
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`${label} over time`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const rx = ((e.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let bd = Infinity;
            for (let i = 0; i < n; i++) {
              const d = Math.abs(xAt(i) - rx);
              if (d < bd) {
                bd = d;
                best = i;
              }
            }
            setHover(best);
          }}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {area ? <path d={area} fill={`url(#${gid})`} /> : null}
          <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
          {active ? (
            <>
              <line
                x1={xAt(hover as number)}
                y1={padY}
                x2={xAt(hover as number)}
                y2={H - padY}
                stroke="#52525b"
                strokeWidth="0.75"
              />
              <circle
                cx={xAt(hover as number)}
                cy={yAt(active.value)}
                r="2.5"
                fill={color}
              />
            </>
          ) : null}
        </svg>
      )}

      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{active ? shortDate(active.date) : shortDate(points[0]?.date ?? "")}</span>
        <span>{shortDate(points[n - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}
