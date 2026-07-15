import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

const CTR_BAND_COLOR: Record<string, string> = {
  "Below average": "bg-red-500/15 text-red-300 border-red-500/25",
  "Average": "bg-zinc-700/40 text-zinc-300 border-zinc-600",
  "Above average": "bg-blue-500/15 text-blue-300 border-blue-500/25",
  "Excellent": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

const LIKELIHOOD_COLOR: Record<string, string> = {
  Low: "text-red-400",
  Medium: "text-amber-400",
  High: "text-emerald-400",
};

function scoreColor(score: number) {
  if (score >= 85) return "bg-emerald-500 text-white";
  if (score >= 70) return "bg-amber-500 text-zinc-950";
  return "bg-red-500/80 text-white";
}

export default async function PredictPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [creativeRows, fatigueAlerts] = await Promise.all([
    db
      .select({
        id: schema.creatives.id,
        type: schema.creatives.type,
        assetUrl: schema.creatives.assetUrl,
        meta: schema.creatives.meta,
        campaignId: schema.creatives.campaignId,
        campaignName: schema.campaigns.name,
        createdAt: schema.creatives.createdAt,
      })
      .from(schema.creatives)
      .leftJoin(schema.campaigns, eq(schema.creatives.campaignId, schema.campaigns.id))
      .where(and(eq(schema.creatives.orgId, org.id), eq(schema.creatives.status, "ready")))
      .orderBy(desc(schema.creatives.createdAt))
      .limit(100),

    db
      .select({
        id: schema.alerts.id,
        campaignId: schema.alerts.campaignId,
        campaignName: schema.campaigns.name,
        message: schema.alerts.message,
        createdAt: schema.alerts.createdAt,
      })
      .from(schema.alerts)
      .leftJoin(schema.campaigns, eq(schema.alerts.campaignId, schema.campaigns.id))
      .where(and(eq(schema.alerts.orgId, org.id), eq(schema.alerts.type, "ad_fatigue"), eq(schema.alerts.status, "open")))
      .orderBy(desc(schema.alerts.createdAt)),
  ]);

  type Meta = { score?: number; scoreRationale?: string; predictedCtrBand?: string; conversionLikelihood?: string };
  const scored = creativeRows
    .map((c) => ({ ...c, meta: (c.meta ?? {}) as Meta }))
    .filter((c) => typeof c.meta.score === "number")
    .sort((a, b) => (b.meta.score ?? 0) - (a.meta.score ?? 0))
    .slice(0, 30);

  const predictedWinner = scored[0];

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl">
            🔮
          </div>
          <div>
            <h1 className="text-2xl font-bold">Predict</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Creative scoring, ad-fatigue detection, and ranking.
            </p>
          </div>
        </div>

        <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-400/20 bg-blue-950/20 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <p className="text-sm text-blue-200">
            <strong>AI estimates, not measured data.</strong> Scores and predictions are calibrated by
            Claude from copy quality alone. Ad fatigue alerts, however, are computed from your real
            Meta performance history.
          </p>
        </div>

        {/* Ad fatigue alerts */}
        {fatigueAlerts.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Ad fatigue detected</h2>
            <div className="space-y-2">
              {fatigueAlerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-950/20 px-4 py-3">
                  <span className="mt-0.5 text-lg">📉</span>
                  <div className="flex-1">
                    <p className="text-sm text-amber-100">{a.message}</p>
                  </div>
                  {a.campaignId && (
                    <Link href={`/dashboard/campaigns/${a.campaignId}`} className="whitespace-nowrap text-xs font-semibold text-amber-400 hover:underline">
                      Open campaign →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ranked creatives */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Creative ranking</h2>

          {scored.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
              <p className="text-3xl">📊</p>
              <p className="mt-3 text-sm text-zinc-500">No scored creatives yet — generate some in Creatives or Generate.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scored.map((c, i) => {
                const isWinner = c.id === predictedWinner?.id;
                return (
                  <div key={c.id} className={`flex items-center gap-4 rounded-xl border p-4 ${
                    isWinner ? "border-amber-400/40 bg-amber-950/15" : "border-zinc-800 bg-zinc-900"
                  }`}>
                    <span className="w-6 shrink-0 text-center text-sm font-bold text-zinc-600">{i + 1}</span>

                    {c.assetUrl && c.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.assetUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg">
                        {c.type === "video" ? "🎬" : "🎨"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isWinner && (
                          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
                            Predicted winner
                          </span>
                        )}
                        <p className="truncate text-sm font-medium text-zinc-200">{c.campaignName ?? "Unassigned"}</p>
                      </div>
                      {c.meta.scoreRationale && <p className="mt-0.5 truncate text-xs text-zinc-500">{c.meta.scoreRationale}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.meta.predictedCtrBand && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${CTR_BAND_COLOR[c.meta.predictedCtrBand] ?? ""}`}>
                            CTR: {c.meta.predictedCtrBand}
                          </span>
                        )}
                        {c.meta.conversionLikelihood && (
                          <span className={`text-[10px] font-medium ${LIKELIHOOD_COLOR[c.meta.conversionLikelihood] ?? "text-zinc-400"}`}>
                            Conversion likelihood: {c.meta.conversionLikelihood}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${scoreColor(c.meta.score ?? 0)}`}>
                      {c.meta.score}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
