import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import type { Strategy } from "@/lib/ai/strategy-schema";
import type { MarketResearch } from "@/lib/ai/research-schema";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import type { BriefInput } from "@/lib/ai/strategist";
import {
  getCampaignProvider,
  type CampaignSpec,
  type CampaignBreakdown,
  type EntityKpis,
} from "@/lib/ads";
import { decryptSecret } from "@/lib/crypto";
import { AutoRefresh } from "./auto-refresh";
import { TrendChart, Sparkline } from "./trend-chart";
import {
  approveLaunch,
  prepareLaunch,
  refreshCampaignMetrics,
  rejectLaunch,
} from "./actions";
import { CreativeCard } from "./creative-card";

type CreativeMeta = {
  concept?: string;
  headline?: string;
  primaryText?: string;
  callToAction?: string;
  score?: number;
  scoreRationale?: string;
  scoreTips?: string[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  generating: "Generating…",
  ready: "Ready",
  failed: "Failed",
};

function money(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

/** Percentage of n over d (e.g. CTR), or em-dash when d is 0. */
function pct(n: number, d: number) {
  return d > 0 ? `${((n / d) * 100).toFixed(2)}%` : "—";
}

/** Plain ratio of n over d (e.g. ROAS), or em-dash when d is 0. */
function ratio(n: number, d: number) {
  return d > 0 ? (n / d).toFixed(2) : "—";
}

const ZERO_KPIS: EntityKpis = {
  impressions: 0,
  reach: 0,
  clicks: 0,
  linkClicks: 0,
  spendMinor: 0,
  conversions: 0,
  conversionValueMinor: 0,
};

function sumKpis(rows: { kpis: EntityKpis }[]): EntityKpis {
  return rows.reduce<EntityKpis>(
    (acc, r) => ({
      impressions: acc.impressions + r.kpis.impressions,
      reach: acc.reach + r.kpis.reach,
      clicks: acc.clicks + r.kpis.clicks,
      linkClicks: acc.linkClicks + r.kpis.linkClicks,
      spendMinor: acc.spendMinor + r.kpis.spendMinor,
      conversions: acc.conversions + r.kpis.conversions,
      conversionValueMinor:
        acc.conversionValueMinor + r.kpis.conversionValueMinor,
    }),
    { ...ZERO_KPIS },
  );
}

const fieldClass =
  "rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm outline-none focus:border-zinc-500";
const panelClass =
  "rounded-lg border border-app-border bg-app-surface p-4";
const primaryButtonClass =
  "rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white";
const secondaryButtonClass =
  "rounded-full border border-app-border-strong bg-app-bg px-4 py-2.5 text-sm font-medium hover:bg-app-surface-2";
const successButtonClass =
  "rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    days?: string;
    since?: string;
    until?: string;
  }>;
}) {
  const { id } = await params;
  const { error, days, since, until } = await searchParams;

  // Date-range / period the analytics (charts, KPIs, breakdown, table) reflect.
  // `since`/`until` (custom) take precedence; otherwise `days` back from today
  // (default 30). Dates are ISO YYYY-MM-DD.
  const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = new Date().toISOString().slice(0, 10);
  const hasCustom = isISO(since) || isISO(until);
  const presetDays = [7, 30, 90, 365].includes(Number(days))
    ? Number(days)
    : 30;
  const activeDays = hasCustom ? null : presetDays;
  const rangeUntil = isISO(until) ? (until as string) : today;
  const rangeSince = isISO(since)
    ? (since as string)
    : // eslint-disable-next-line react-hooks/purity -- per-request server component; "now" is intentional
      new Date(Date.now() - presetDays * 86_400_000)
        .toISOString()
        .slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.orgId, org.id)))
    .limit(1);
  if (!campaign) notFound();

  const [creatives, adAccounts, audit, pendingApprovals, metrics, entityRows] =
    await Promise.all([
      db
        .select()
        .from(schema.creatives)
        .where(eq(schema.creatives.campaignId, id))
        .orderBy(asc(schema.creatives.createdAt)),
      db.select().from(schema.adAccounts).where(eq(schema.adAccounts.orgId, org.id)),
      db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.campaignId, id))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(10),
      db
        .select()
        .from(schema.approvals)
        .where(
          and(
            eq(schema.approvals.entityId, id),
            eq(schema.approvals.orgId, org.id),
            eq(schema.approvals.status, "pending"),
          ),
        )
        .orderBy(desc(schema.approvals.createdAt))
        .limit(5),
      db
        .select()
        .from(schema.metricsSnapshots)
        .where(
          and(
            eq(schema.metricsSnapshots.campaignId, id),
            gte(schema.metricsSnapshots.date, rangeSince),
            lte(schema.metricsSnapshots.date, rangeUntil),
          ),
        )
        .orderBy(desc(schema.metricsSnapshots.date))
        .limit(400),
      db
        .select()
        .from(schema.entityMetrics)
        .where(
          and(
            eq(schema.entityMetrics.campaignId, id),
            gte(schema.entityMetrics.date, rangeSince),
            lte(schema.entityMetrics.date, rangeUntil),
          ),
        )
        .orderBy(asc(schema.entityMetrics.date)),
    ]);

  // Per-entity daily spend series (chronological), keyed by platform id.
  const entitySpend = new Map<string, { date: string; value: number }[]>();
  for (const r of entityRows) {
    const arr = entitySpend.get(r.externalId) ?? [];
    arr.push({ date: r.date, value: r.spendMinor });
    entitySpend.set(r.externalId, arr);
  }

  const pendingLaunch = pendingApprovals.find(
    (a) => a.entityType === "campaign_launch",
  );
  const pendingOptimization = pendingApprovals.find(
    (a) => a.entityType === "optimization",
  );
  const launchSpec = pendingLaunch
    ? (pendingLaunch.payload as { spec: CampaignSpec }).spec
    : null;
  const optimization = pendingOptimization
    ? ((pendingOptimization.payload as { proposal: OptimizationProposal }).proposal ??
      null)
    : null;

  const strategy = campaign.strategy as Strategy | null;
  const research = campaign.research as MarketResearch | null;
  const externalIds = (campaign.externalIds ?? {}) as Record<string, string>;
  const brief = (campaign.brief ?? {}) as BriefInput;
  const destinationUrl = (brief.websiteUrl ?? "").trim();
  const isWhatsAppDest = brief.destination === "whatsapp";
  // What the launch pipeline will publish: a real ad needs a click destination
  // (landing page, or the Page's WhatsApp number for CTWA) + ≥1 creative.
  const launchHasCreative = creatives.length > 0;
  const launchReady =
    (Boolean(destinationUrl) || isWhatsAppDest) && launchHasCreative;
  const pendingCreatives = creatives.filter(
    (c) => c.status === "pending" || c.status === "generating",
  ).length;
  const isLive = campaign.status === "active" || campaign.status === "paused";
  // The agent is still planning in the background until a strategy exists.
  const generating = campaign.status === "draft" && !strategy;

  // Live ad-set + ad breakdown with KPIs (last 30 days). Fetched on demand from
  // the platform for any campaign linked to a real ad account; resilient so a
  // Meta hiccup never breaks the page.
  const externalCampaignId = externalIds[campaign.platform];
  let breakdown: CampaignBreakdown | null = null;
  let breakdownError: string | null = null;
  // The campaign row's currency can be stale (import hardcoded it); prefer the
  // connected ad account's real currency for the live breakdown figures.
  let breakdownCurrency = campaign.currency;
  if (externalCampaignId) {
    // Prefer the account the campaign is linked to; otherwise fall back to any
    // connected account on the same platform (the OAuth user token can read all
    // of the user's campaigns) — covers campaigns imported before adAccountId
    // was tracked.
    const adAccount =
      (campaign.adAccountId
        ? adAccounts.find((a) => a.id === campaign.adAccountId)
        : undefined) ??
      adAccounts.find(
        (a) => a.platform === campaign.platform && a.encryptedToken,
      );
    const acctCurrency = (adAccount?.meta as { currency?: string } | null)
      ?.currency;
    if (acctCurrency) breakdownCurrency = acctCurrency;
    if (adAccount?.encryptedToken) {
      try {
        const provider = getCampaignProvider(campaign.platform);
        const token = decryptSecret(adAccount.encryptedToken);
        breakdown = await provider.getCampaignBreakdown(
          { externalCampaignId, since: rangeSince, until: rangeUntil },
          token,
        );
      } catch (e) {
        breakdownError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // Daily metrics → chronological series for the trend charts (oldest → newest);
  // the detail table below shows the most recent days.
  const chrono = [...metrics].reverse();
  const recentMetrics = metrics.slice(0, 30);
  const series = {
    spend: chrono.map((m) => ({ date: m.date, value: m.spendMinor })),
    impressions: chrono.map((m) => ({ date: m.date, value: m.impressions })),
    clicks: chrono.map((m) => ({ date: m.date, value: m.clicks })),
    conversions: chrono.map((m) => ({ date: m.date, value: m.conversions })),
    ctr: chrono.map((m) => ({
      date: m.date,
      value: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
    })),
    roas: chrono.map((m) => ({
      date: m.date,
      value: m.spendMinor > 0 ? m.conversionValueMinor / m.spendMinor : 0,
    })),
  };

  return (
    <main className="min-h-screen px-4 py-5 text-app-text sm:px-6 lg:px-8">
      <AutoRefresh enabled={generating || pendingCreatives > 0} />
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard/campaigns"
          className="text-sm text-app-text-muted hover:text-app-text"
        >
          ← Campaigns
        </Link>
        <header className="mt-3 rounded-lg border border-app-border bg-app-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{campaign.name}</h1>
            <p className="text-sm text-app-text-muted">
              {campaign.platform} · {campaign.status}
              {pendingCreatives > 0
                ? ` · ${pendingCreatives} creative(s) generating`
                : ""}
            </p>
          </div>
        </header>

        {generating ? (
          <section className="mt-4 rounded-lg border border-amber-400/30 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-200">
              🔎 MarkAI is researching the market and building your strategy &amp;
              creatives… this page refreshes automatically.
            </p>
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {/* ----- Launch / approval gate ----- */}
        <section className={`mt-6 ${panelClass}`}>
          <h2 className="text-lg font-medium">Launch</h2>

          {campaign.status === "draft" && strategy ? (
            adAccounts.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-app-text-muted">
                  Launch builds the full ad on Meta — campaign → ad set
                  (budget + targeting) → ad creative → ad — all{" "}
                  <span className="text-app-text">paused</span> until you approve
                  spend.
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li
                    className={
                      destinationUrl || isWhatsAppDest
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {destinationUrl || isWhatsAppDest ? "✓" : "•"} Destination{" "}
                    {isWhatsAppDest ? (
                      <span className="text-app-text-muted">
                        — WhatsApp chat (needs a WhatsApp Business number on
                        your Facebook Page)
                      </span>
                    ) : destinationUrl ? (
                      <span className="text-app-text-muted">— {destinationUrl}</span>
                    ) : (
                      <span className="text-app-text-muted">
                        — required; add a URL to the brief to launch
                      </span>
                    )}
                  </li>
                  <li className={launchHasCreative ? "text-emerald-300" : "text-amber-300"}>
                    {launchHasCreative ? "✓" : "•"} Creative{" "}
                    <span className="text-app-text-muted">
                      — {creatives.length} generated
                      {pendingCreatives > 0 ? ` (${pendingCreatives} still rendering)` : ""}
                    </span>
                  </li>
                  <li className="text-app-text-muted">
                    • Target countries —{" "}
                    {brief.geoCountries
                      ? String(
                          Array.isArray(brief.geoCountries)
                            ? brief.geoCountries.join(", ")
                            : brief.geoCountries,
                        )
                      : "US (default)"}
                  </li>
                </ul>
                <form action={prepareLaunch} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-app-text-muted">Ad account</span>
                    <select
                      name="adAccountId"
                      className={fieldClass}
                      defaultValue={adAccounts[0]?.id}
                    >
                      {adAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.platform} · {a.externalId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={primaryButtonClass}
                    disabled={!launchReady}
                    title={
                      launchReady
                        ? undefined
                        : "Add a destination URL and wait for a creative before launching"
                    }
                  >
                    Prepare launch →
                  </button>
                </form>
                {!launchReady ? (
                  <p className="mt-2 text-xs text-amber-300/80">
                    Add a destination URL (and at least one creative) before
                    launching.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-app-text-muted">
                Connect an ad account in{" "}
                <Link href="/dashboard/settings" className="underline">
                  Settings
                </Link>{" "}
                to launch this campaign.
              </p>
            )
          ) : null}

          {campaign.status === "pending_approval" && launchSpec && pendingLaunch ? (
            <div className="mt-3">
              <p className="text-sm text-amber-300">
                ⏸ Awaiting your approval — nothing is spent until you approve.
              </p>
              <p className="mt-3 text-xs text-app-text-subtle">
                Approving creates this on Meta (all paused):
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-app-text-subtle">Campaign</dt>
                <dd>{launchSpec.name}</dd>
                <dt className="text-app-text-subtle">Objective</dt>
                <dd>{launchSpec.objective}</dd>
                <dt className="text-app-text-subtle">Daily budget</dt>
                <dd>{money(launchSpec.dailyBudgetMinor, launchSpec.currency)}</dd>
                <dt className="text-app-text-subtle">Targeting</dt>
                <dd>
                  {brief.geoCountries
                    ? String(
                        Array.isArray(brief.geoCountries)
                          ? brief.geoCountries.join(", ")
                          : brief.geoCountries,
                      )
                    : "US"}
                </dd>
                <dt className="text-app-text-subtle">Destination</dt>
                <dd className="truncate">{destinationUrl || "—"}</dd>
                <dt className="text-app-text-subtle">Creatives</dt>
                <dd>
                  {(() => {
                    // Mirrors executeLaunch: top 3 by score, ready first — 2+
                    // launch as ads in one ad set (an A/B test the agent
                    // resolves once each variant has data).
                    const ready = creatives.filter((c) => c.status === "ready");
                    const pool = ready.length ? ready : creatives;
                    const ship = [...pool]
                      .sort(
                        (a, b) =>
                          Number((b.meta as CreativeMeta)?.score ?? -1) -
                          Number((a.meta as CreativeMeta)?.score ?? -1),
                      )
                      .slice(0, 3);
                    if (ship.length === 0) return "—";
                    const names = ship.map((c) => {
                      const m = (c.meta ?? {}) as CreativeMeta;
                      return `${m.headline ?? m.concept ?? "Ad"}${
                        m.score != null ? ` (${m.score})` : ""
                      }`;
                    });
                    return ship.length > 1
                      ? `A/B test — ${ship.length} variants: ${names.join(" · ")}`
                      : names[0];
                  })()}
                </dd>
              </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                <form action={approveLaunch}>
                  <input type="hidden" name="approvalId" value={pendingLaunch.id} />
                  <button className={successButtonClass}>
                    Approve &amp; launch
                  </button>
                </form>
                <form action={rejectLaunch}>
                  <input type="hidden" name="approvalId" value={pendingLaunch.id} />
                  <button className={secondaryButtonClass}>
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {campaign.status === "active" ? (
            <div className="mt-2 text-sm text-emerald-300">
              <p>✓ Launched on Meta (paused — unpause in Ads Manager to spend).</p>
              {externalIds.meta || externalIds.tiktok ? (
                <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 font-mono text-xs text-app-text-muted">
                  {externalIds.meta ? (
                    <>
                      <dt className="text-app-text-subtle">Campaign</dt>
                      <dd>{externalIds.meta}</dd>
                    </>
                  ) : null}
                  {externalIds.metaAdSet ? (
                    <>
                      <dt className="text-app-text-subtle">Ad set</dt>
                      <dd>{externalIds.metaAdSet}</dd>
                    </>
                  ) : null}
                  {externalIds.metaAd ? (
                    <>
                      <dt className="text-app-text-subtle">Ad</dt>
                      <dd>{externalIds.metaAd}</dd>
                    </>
                  ) : null}
                  {externalIds.tiktok ? (
                    <>
                      <dt className="text-app-text-subtle">TikTok</dt>
                      <dd>{externalIds.tiktok}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </div>
          ) : null}

          {campaign.status === "paused" ? (
            <p className="mt-2 text-sm text-amber-300">Paused.</p>
          ) : null}

          {campaign.status === "completed" ? (
            <p className="mt-2 text-sm text-app-text-muted">Completed.</p>
          ) : null}

          {campaign.status === "failed" ? (
            <p className="mt-2 text-sm text-red-300">
              Launch failed — see the activity log below.
            </p>
          ) : null}
        </section>

        {/* ----- Optimization loop (Phase 3) ----- */}
        {isLive ? (
          <section className={`mt-6 ${panelClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Optimization chat</h2>
                <p className="mt-1 text-sm text-app-text-muted">
                  Open a dedicated chat screen for recommendations and approvals.
                </p>
              </div>
              <Link
                href={`/dashboard/campaigns/${campaign.id}/chat`}
                target="_blank"
                rel="noreferrer"
                className={primaryButtonClass}
              >
                Open AI chat
              </Link>
            </div>

            {optimization && pendingOptimization ? (
              <div className="mt-3 rounded-lg border border-app-border bg-app-bg p-4 text-sm text-app-text">
                Pending recommendation: {optimization.action.toUpperCase()} · confidence {optimization.confidence}
              </div>
            ) : null}

            {externalIds[campaign.platform] ? (
              <form action={refreshCampaignMetrics} className="mt-3">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <button className={secondaryButtonClass}>
                  Refresh metrics (last 12 months)
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {/* ----- Date range control ----- */}
        {externalCampaignId || metrics.length > 0 ? (
          <section className={`mt-6 ${panelClass} p-5`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-app-text-subtle">
                  Date range
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    { d: 7, l: "7d" },
                    { d: 30, l: "30d" },
                    { d: 90, l: "90d" },
                    { d: 365, l: "12mo" },
                  ].map((o) => (
                    <Link
                      key={o.d}
                      href={`?days=${o.d}`}
                      className={
                        activeDays === o.d
                          ? "rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950"
                          : "rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm hover:bg-white/10"
                      }
                    >
                      {o.l}
                    </Link>
                  ))}
                </div>
              </div>
              <form method="get" className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-app-text-subtle">
                  From
                  <input
                    type="date"
                    name="since"
                    defaultValue={rangeSince}
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-app-text-subtle">
                  To
                  <input
                    type="date"
                    name="until"
                    defaultValue={rangeUntil}
                    className={fieldClass}
                  />
                </label>
                <button className={secondaryButtonClass}>
                  Apply
                </button>
              </form>
            </div>
            <p className="mt-2 text-xs text-app-text-subtle">
              Showing {rangeSince} → {rangeUntil}
              {hasCustom ? " (custom)" : ""}
            </p>
          </section>
        ) : null}

        {/* ----- Ad sets & ads (KPI breakdown) ----- */}
        {externalCampaignId && (breakdown || breakdownError) ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Ad sets &amp; ads</h2>
            <p className="mt-1 text-xs text-app-text-subtle">
              Live from the Meta Ads API · KPIs for {rangeSince} → {rangeUntil}
            </p>

            {breakdownError ? (
              <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
                Couldn’t load from Meta: {breakdownError}
              </p>
            ) : breakdown ? (
              (() => {
                const totals = sumKpis(breakdown.adSets);
                const adSetName = new Map(
                  breakdown.adSets.map((s) => [s.id, s.name]),
                );
                const summary = [
                  { label: "Spend", value: money(totals.spendMinor, breakdownCurrency) },
                  { label: "Impressions", value: totals.impressions.toLocaleString() },
                  { label: "Clicks", value: totals.clicks.toLocaleString() },
                  { label: "CTR", value: pct(totals.clicks, totals.impressions) },
                  { label: "Conversions", value: totals.conversions.toLocaleString() },
                  { label: "ROAS", value: ratio(totals.conversionValueMinor, totals.spendMinor) },
                ];
                return (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {summary.map((k) => (
                        <div
                          key={k.label}
                          className="rounded-2xl border border-white/10 bg-black/15 p-4"
                        >
                          <div className="text-xs uppercase tracking-wide text-app-text-subtle">
                            {k.label}
                          </div>
                          <div className="mt-1 text-lg font-semibold">{k.value}</div>
                        </div>
                      ))}
                    </div>

                    <h3 className="mt-6 text-sm font-medium text-app-text">
                      Ad sets ({breakdown.adSets.length})
                    </h3>
                    {breakdown.adSets.length === 0 ? (
                      <p className="mt-2 text-sm text-app-text-subtle">No ad sets found.</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-app-text-subtle">
                            <tr>
                              {["Ad set", "Spend trend", "Status", "Budget/day", "Impr.", "Clicks", "CTR", "Spend", "Conv.", "ROAS"].map((h) => (
                                <th key={h} className="py-1 pr-3 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-app-text">
                            {breakdown.adSets.map((s) => (
                              <tr key={s.id} className="border-t border-app-border/60">
                                <td className="py-1 pr-3">{s.name}</td>
                                <td className="py-1 pr-3">
                                  <Sparkline points={entitySpend.get(s.id) ?? []} />
                                </td>
                                <td className="py-1 pr-3 lowercase">{s.status}</td>
                                <td className="whitespace-nowrap py-1 pr-3">
                                  {s.dailyBudgetMinor != null
                                    ? money(s.dailyBudgetMinor, breakdownCurrency)
                                    : "—"}
                                </td>
                                <td className="py-1 pr-3">{s.kpis.impressions.toLocaleString()}</td>
                                <td className="py-1 pr-3">{s.kpis.clicks.toLocaleString()}</td>
                                <td className="py-1 pr-3">{pct(s.kpis.clicks, s.kpis.impressions)}</td>
                                <td className="whitespace-nowrap py-1 pr-3">{money(s.kpis.spendMinor, breakdownCurrency)}</td>
                                <td className="py-1 pr-3">{s.kpis.conversions.toLocaleString()}</td>
                                <td className="py-1">{ratio(s.kpis.conversionValueMinor, s.kpis.spendMinor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <h3 className="mt-6 text-sm font-medium text-app-text">
                      Ads ({breakdown.ads.length})
                    </h3>
                    {breakdown.ads.length === 0 ? (
                      <p className="mt-2 text-sm text-app-text-subtle">No ads found.</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-app-text-subtle">
                            <tr>
                              {["Ad", "Spend trend", "Ad set", "Status", "Impr.", "Clicks", "CTR", "Spend", "Conv.", "ROAS"].map((h) => (
                                <th key={h} className="py-1 pr-3 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-app-text">
                            {breakdown.ads.map((ad) => (
                              <tr key={ad.id} className="border-t border-app-border/60">
                                <td className="py-1 pr-3">{ad.name}</td>
                                <td className="py-1 pr-3">
                                  <Sparkline points={entitySpend.get(ad.id) ?? []} />
                                </td>
                                <td className="py-1 pr-3 text-app-text-subtle">
                                  {ad.adSetId ? adSetName.get(ad.adSetId) ?? "—" : "—"}
                                </td>
                                <td className="py-1 pr-3 lowercase">{ad.status}</td>
                                <td className="py-1 pr-3">{ad.kpis.impressions.toLocaleString()}</td>
                                <td className="py-1 pr-3">{ad.kpis.clicks.toLocaleString()}</td>
                                <td className="py-1 pr-3">{pct(ad.kpis.clicks, ad.kpis.impressions)}</td>
                                <td className="whitespace-nowrap py-1 pr-3">{money(ad.kpis.spendMinor, breakdownCurrency)}</td>
                                <td className="py-1 pr-3">{ad.kpis.conversions.toLocaleString()}</td>
                                <td className="py-1">{ratio(ad.kpis.conversionValueMinor, ad.kpis.spendMinor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()
            ) : null}
          </section>
        ) : null}

        {/* ----- Trends over time (charts) ----- */}
        {metrics.length > 0 ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Trends</h2>
            <p className="mt-1 text-xs text-app-text-subtle">
              Daily metrics over {metrics.length} day(s) · hover a chart for a
              specific day
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TrendChart
                label="Spend"
                points={series.spend}
                color="#fbbf24"
                format="money"
                currency={breakdownCurrency}
              />
              <TrendChart
                label="Impressions"
                points={series.impressions}
                color="#38bdf8"
              />
              <TrendChart label="Clicks" points={series.clicks} color="#34d399" />
              <TrendChart
                label="Conversions"
                points={series.conversions}
                color="#a78bfa"
              />
              <TrendChart
                label="CTR %"
                points={series.ctr}
                color="#f472b6"
                format="percent"
              />
              <TrendChart
                label="ROAS"
                points={series.roas}
                color="#2dd4bf"
                format="ratio"
              />
            </div>
          </section>
        ) : null}

        {/* ----- Metrics ----- */}
        {metrics.length > 0 ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Performance</h2>
            <p className="mt-1 text-xs text-app-text-subtle">
              From the Meta Ads insights API · most recent {recentMetrics.length}{" "}
              day(s)
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-app-text-subtle">
                  <tr>
                    {[
                      "Date",
                      "Reach",
                      "Impr.",
                      "Freq",
                      "Clicks",
                      "Link",
                      "CTR",
                      "CPC",
                      "CPM",
                      "Spend",
                      "Conv.",
                      "Cost/Conv",
                      "ROAS",
                    ].map((h) => (
                      <th key={h} className="py-1 pr-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-app-text">
                  {recentMetrics.map((m) => (
                    <tr key={m.id} className="border-t border-app-border/60">
                      <td className="whitespace-nowrap py-1 pr-3">{m.date}</td>
                      <td className="py-1 pr-3">{m.reach.toLocaleString()}</td>
                      <td className="py-1 pr-3">{m.impressions.toLocaleString()}</td>
                      <td className="py-1 pr-3">
                        {m.reach > 0 ? (m.impressions / m.reach).toFixed(2) : "—"}
                      </td>
                      <td className="py-1 pr-3">{m.clicks.toLocaleString()}</td>
                      <td className="py-1 pr-3">{m.linkClicks.toLocaleString()}</td>
                      <td className="py-1 pr-3">
                        {m.impressions > 0
                          ? `${((m.clicks / m.impressions) * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-3">
                        {m.clicks > 0
                          ? money(Math.round(m.spendMinor / m.clicks), breakdownCurrency)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-3">
                        {m.impressions > 0
                          ? money(
                              Math.round((m.spendMinor / m.impressions) * 1000),
                              breakdownCurrency,
                            )
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-3">
                        {money(m.spendMinor, breakdownCurrency)}
                      </td>
                      <td className="py-1 pr-3">{m.conversions}</td>
                      <td className="whitespace-nowrap py-1 pr-3">
                        {m.conversions > 0
                          ? money(
                              Math.round(m.spendMinor / m.conversions),
                              breakdownCurrency,
                            )
                          : "—"}
                      </td>
                      <td className="py-1">
                        {m.spendMinor > 0
                          ? (m.conversionValueMinor / m.spendMinor).toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ----- Market research (agent step 0) ----- */}
        {research ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Market research</h2>
            <p className="mt-2 text-sm text-app-text">{research.marketOverview}</p>

            <h3 className="mt-4 text-xs uppercase tracking-wide text-app-text-subtle">
              Competitors
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {research.competitors.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-app-border bg-app-bg/40 p-3 text-sm"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-1 text-app-text-muted">{c.positioning}</div>
                  <div className="mt-1 text-xs text-emerald-300">Gap: {c.gaps}</div>
                </div>
              ))}
            </div>

            <h3 className="mt-4 text-xs uppercase tracking-wide text-app-text-subtle">
              Audience personas
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {research.audiencePersonas.map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-app-border bg-app-bg/40 p-3 text-sm"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-1 text-app-text-muted">{p.description}</div>
                  <div className="mt-2 text-xs text-app-text-subtle">Pains</div>
                  <ul className="list-disc pl-4 text-xs text-app-text">
                    {p.painPoints.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-xs text-app-text-subtle">Hooks</div>
                  <ul className="list-disc pl-4 text-xs text-app-text">
                    {p.messagingHooks.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-app-text-subtle">
                  Opportunities
                </h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-app-text">
                  {research.opportunities.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-app-text-subtle">
                  Recommended channels
                </h3>
                <p className="mt-1 text-sm text-app-text">
                  {research.recommendedChannels.join(", ")}
                </p>
              </div>
            </div>

            {research.sources.length > 0 ? (
              <p className="mt-3 text-xs text-app-text-subtle">
                Sources: {research.sources.slice(0, 6).join(" · ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ----- Strategy ----- */}
        {strategy ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Strategy</h2>
            <p className="mt-2 text-sm text-app-text">{strategy.positioning}</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-app-text-subtle">
                  Audience
                </h3>
                <p className="mt-1 text-sm text-app-text">
                  {strategy.targetAudience.summary}
                </p>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-app-text-subtle">
                  Key messages
                </h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-app-text">
                  {strategy.keyMessages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {/* ----- Creatives ----- */}
        <section className={`mt-6 ${panelClass}`}>
          <h2 className="text-lg font-medium">Creatives</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {creatives.map((cr) => {
              const meta = (cr.meta ?? {}) as CreativeMeta & { template?: string };
              return (
                <CreativeCard
                  key={cr.id}
                  id={cr.id}
                  type={cr.type}
                  status={cr.status}
                  template={meta.template}
                  headline={meta.headline}
                  primaryText={meta.primaryText}
                  score={typeof meta.score === "number" ? meta.score : null}
                  scoreRationale={meta.scoreRationale}
                  scoreTips={meta.scoreTips}
                  statusLabel={STATUS_LABEL[cr.status] ?? cr.status}
                  assetVersion={cr.assetUrl?.slice(0, 12) ?? null}
                  assetUrl={cr.assetUrl}
                />
              );
            })}
          </div>
        </section>

        {/* ----- Activity log ----- */}
        {audit.length > 0 ? (
          <section className={`mt-6 ${panelClass}`}>
            <h2 className="text-lg font-medium">Activity</h2>
            <ul className="mt-3 space-y-1 text-sm text-app-text-muted">
              {audit.map((a) => (
                <li key={a.id}>
                  <span className="text-app-text-subtle">
                    {a.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </span>{" "}
                  · {a.actor} · {a.action}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
