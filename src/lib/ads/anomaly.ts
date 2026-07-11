/**
 * Rule-based anomaly detection over a campaign's recent daily metrics.
 * Deterministic and free (no AI call) so it can run on every metrics sync.
 * The detector only *proposes* — persistence and dedup live in the caller.
 *
 * Conventions: `snapshots` are daily rows sorted ASC by date, the last row
 * being the most recent synced day. Trailing baselines exclude that day.
 */

export interface DailyMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spendMinor: number;
  conversions: number;
}

export interface AnomalyCandidate {
  type: "spend_spike" | "ctr_collapse" | "delivery_stop" | "conversion_stop";
  severity: "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
}

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency}`;

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

export function detectAnomalies(args: {
  campaignName: string;
  currency: string;
  dailyBudgetMinor: number | null;
  snapshots: DailyMetrics[];
}): AnomalyCandidate[] {
  const { campaignName, currency, dailyBudgetMinor, snapshots } = args;
  if (snapshots.length < 2) return [];

  const latest = snapshots[snapshots.length - 1];
  const prior = snapshots.slice(0, -1).slice(-7); // up to 7 days before latest
  const out: AnomalyCandidate[] = [];

  // ── Spend spike: latest day far above budget and/or its own trailing average.
  const priorSpendAvg = avg(prior.map((d) => d.spendMinor));
  const overBudget =
    dailyBudgetMinor != null &&
    dailyBudgetMinor > 0 &&
    latest.spendMinor > dailyBudgetMinor * 1.5;
  const overTrend = priorSpendAvg > 0 && latest.spendMinor > priorSpendAvg * 2;
  if (latest.spendMinor >= 500 && (overBudget || overTrend)) {
    out.push({
      type: "spend_spike",
      severity: overBudget ? "critical" : "warning",
      message:
        `“${campaignName}” spent ${money(latest.spendMinor, currency)} on ${latest.date}` +
        (overBudget
          ? ` — over 1.5× the ${money(dailyBudgetMinor!, currency)} daily budget.`
          : ` — more than double its recent daily average (${money(Math.round(priorSpendAvg), currency)}).`),
      data: {
        date: latest.date,
        spendMinor: latest.spendMinor,
        dailyBudgetMinor,
        priorSpendAvgMinor: Math.round(priorSpendAvg),
      },
    });
  }

  // ── Delivery stop: was delivering, now zero impressions.
  const priorImprAvg = avg(prior.map((d) => d.impressions));
  if (latest.impressions === 0 && priorImprAvg > 100) {
    out.push({
      type: "delivery_stop",
      severity: "critical",
      message:
        `“${campaignName}” delivered 0 impressions on ${latest.date} after averaging ` +
        `${Math.round(priorImprAvg).toLocaleString("en-US")}/day — delivery may have stopped (rejected ad, billing issue, or paused ad set).`,
      data: { date: latest.date, priorImpressionsAvg: Math.round(priorImprAvg) },
    });
  }

  // ── CTR collapse: recent 3-day CTR under half the prior baseline, still delivering.
  const recent3 = snapshots.slice(-3);
  const base = snapshots.slice(0, -3).slice(-7);
  const ctr = (rows: DailyMetrics[]) => {
    const impr = rows.reduce((s, d) => s + d.impressions, 0);
    const clicks = rows.reduce((s, d) => s + d.clicks, 0);
    return impr > 0 ? clicks / impr : 0;
  };
  const recentImpr = recent3.reduce((s, d) => s + d.impressions, 0);
  const baseCtr = ctr(base);
  const recentCtr = ctr(recent3);
  if (base.length >= 3 && recentImpr >= 500 && baseCtr > 0 && recentCtr < baseCtr * 0.5) {
    out.push({
      type: "ctr_collapse",
      severity: "warning",
      message:
        `“${campaignName}” CTR fell to ${(recentCtr * 100).toFixed(2)}% over the last 3 days ` +
        `(was ${(baseCtr * 100).toFixed(2)}%) while still delivering — likely creative fatigue.`,
      data: {
        recentCtr: +(recentCtr * 100).toFixed(3),
        baselineCtr: +(baseCtr * 100).toFixed(3),
        recentImpressions: recentImpr,
      },
    });
  }

  // ── Conversion stop: converting before, spending now, zero conversions 3 days.
  const priorConversions = base.reduce((s, d) => s + d.conversions, 0);
  const recentConversions = recent3.reduce((s, d) => s + d.conversions, 0);
  const recentSpend = recent3.reduce((s, d) => s + d.spendMinor, 0);
  if (priorConversions >= 3 && recentConversions === 0 && recentSpend >= 500) {
    out.push({
      type: "conversion_stop",
      severity: "warning",
      message:
        `“${campaignName}” has spent ${money(recentSpend, currency)} over 3 days with 0 conversions ` +
        `(previously ${priorConversions} in the prior week) — check the landing page, pixel, or offer.`,
      data: { recentSpendMinor: recentSpend, priorConversions },
    });
  }

  return out;
}
