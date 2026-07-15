import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { signOut } from "../login/actions";
import { dismissAlert } from "./alerts-actions";
import { approveAllocation, rejectAllocation } from "./allocation-actions";
import { AUTONOMY_LABELS } from "@/lib/manager/policy";
import type { ReportPayload } from "@/lib/ai/reporter";
import type { AllocationProposal } from "@/lib/ai/allocator";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { org } = await ensureProfile(user);

  // Fetch real stats in parallel
  const [
    [{ campaignCount }],
    [{ creativeCount }],
    [{ accountCount }],
    [{ brandCount }],
    [latestReport],
    [suggestedProduct],
  ] = await Promise.all([
    db
      .select({ campaignCount: count() })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id)),
    db
      .select({ creativeCount: count() })
      .from(schema.creatives)
      .where(eq(schema.creatives.orgId, org.id)),
    db
      .select({ accountCount: count() })
      .from(schema.adAccounts)
      .where(eq(schema.adAccounts.orgId, org.id)),
    db
      .select({ brandCount: count() })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, org.id)),
    db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.orgId, org.id))
      .orderBy(desc(schema.reports.createdAt))
      .limit(1),
    // Most recent catalog product — used for the "Suggested campaign" nudge
    // when the org hasn't launched anything yet.
    db
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.orgId, org.id))
      .orderBy(desc(schema.products.createdAt))
      .limit(1),
  ]);

  const openAlerts = await db
    .select({
      id: schema.alerts.id,
      campaignId: schema.alerts.campaignId,
      type: schema.alerts.type,
      severity: schema.alerts.severity,
      message: schema.alerts.message,
      createdAt: schema.alerts.createdAt,
    })
    .from(schema.alerts)
    .where(and(eq(schema.alerts.orgId, org.id), eq(schema.alerts.status, "open")))
    .orderBy(desc(schema.alerts.createdAt))
    .limit(10);

  const [pendingAllocation] = await db
    .select()
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.orgId, org.id),
        eq(schema.approvals.entityType, "budget_allocation"),
        eq(schema.approvals.status, "pending"),
      ),
    )
    .orderBy(desc(schema.approvals.createdAt))
    .limit(1);

  const autonomyLabel = AUTONOMY_LABELS[org.autonomyLevel] ?? org.autonomyLevel;

  return (
    <main className="min-h-screen px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Overview</h1>
            <p className="mt-0.5 text-sm text-zinc-400">{org.name} · {user.email}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </header>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
          <StatCard label="Campaigns" value={campaignCount} href="/dashboard/campaigns" />
          <StatCard label="Creatives" value={creativeCount} href="/dashboard/creatives" />
          <StatCard label="Brands" value={brandCount} href="/dashboard/brands" />
          <StatCard
            label="Ad accounts"
            value={accountCount}
            href="/dashboard/settings"
            badge={accountCount === 0 ? "Connect" : undefined}
          />
        </div>

        {/* AI autonomy notice */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
            <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm text-zinc-300">AI autonomy: </span>
            <span className="text-sm font-medium text-zinc-100">{autonomyLabel}</span>
          </div>
          <Link href="/dashboard/settings" className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300">
            Change →
          </Link>
        </div>

        {/* Suggested campaign — nudge toward the first launch using an existing product. */}
        {campaignCount === 0 && suggestedProduct && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-950/20 px-4 py-3">
            <span className="text-lg">💡</span>
            <p className="min-w-0 flex-1 text-sm text-amber-100">
              Suggested: launch a campaign for <strong>{suggestedProduct.name}</strong>.
            </p>
            <Link
              href={`/dashboard/campaigns/new?${new URLSearchParams({ productName: suggestedProduct.name }).toString()}`}
              className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-300"
            >
              Start →
            </Link>
          </div>
        )}

        {/* Open anomaly alerts */}
        {openAlerts.length > 0 && (
          <div className="mt-6 space-y-2">
            {openAlerts.map((a) => (
              <div key={a.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  a.severity === "critical"
                    ? "border-red-400/30 bg-red-950/30"
                    : "border-amber-400/25 bg-amber-950/20"
                }`}>
                <svg className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-red-400" : "text-amber-400"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-zinc-200">{a.message}</p>
                  <Link href={`/dashboard/campaigns/${a.campaignId}`}
                    className={`mt-1 inline-block text-xs font-medium hover:underline ${
                      a.severity === "critical" ? "text-red-300" : "text-amber-300"
                    }`}>
                    Open campaign →
                  </Link>
                </div>
                <form action={dismissAlert}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                    Dismiss
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Pending budget reallocation (org-level approval) */}
        {pendingAllocation ? (
          <AllocationCard
            approvalId={pendingAllocation.id}
            payload={
              pendingAllocation.payload as {
                proposal: AllocationProposal;
                currency: string;
                totalMinor: number;
                proposedTotal: number;
              }
            }
          />
        ) : null}

        {/* Latest AI weekly report */}
        {latestReport ? (
          <WeeklyReportCard
            report={latestReport.payload as ReportPayload}
            periodStart={latestReport.periodStart}
            periodEnd={latestReport.periodEnd}
          />
        ) : null}

        {/* Quick actions grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickCard
            tag="Create"
            title="New campaign"
            description="Turn a product brief into an AI strategy and creative plan."
            cta="Open brief"
            href="/dashboard/campaigns/new"
            accent="amber"
          />
          <QuickCard
            tag="Generate"
            title="AI assets"
            description="Ad creatives, copy, social captions, and buyer personas."
            cta="Browse tools"
            href="/dashboard/generate"
            accent="violet"
          />
          <QuickCard
            tag="Brand"
            title="Brand profiles"
            description="Save your logo, colors, and tone to reuse across every creative."
            cta="Manage brands"
            href="/dashboard/brands"
            accent="emerald"
          />
          <QuickCard
            tag="Library"
            title="All creatives"
            description="Review scored creatives, download assets, and track generation status."
            cta="View creatives"
            href="/dashboard/creatives"
            accent="sky"
          />
          <QuickCard
            tag="Monitor"
            title="Campaign library"
            description="Review live and drafted campaigns and request optimization."
            cta="View campaigns"
            href="/dashboard/campaigns"
            accent="zinc"
          />
          <QuickCard
            tag="Configure"
            title="Settings"
            description="Connect ad accounts, set Meta OAuth, and manage AI autonomy."
            cta="Open settings"
            href="/dashboard/settings"
            accent="zinc"
          />
        </div>

        {/* Workflow steps */}
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Launch workflow</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[
              { step: "1", label: "Write brief", href: "/dashboard/campaigns/new" },
              { step: "2", label: "Generate strategy", href: "/dashboard/campaigns" },
              { step: "3", label: "Review creatives", href: "/dashboard/creatives" },
              { step: "4", label: "Approve launch", href: "/dashboard/campaigns" },
              { step: "5", label: "Import metrics", href: "/dashboard/campaigns" },
              { step: "6", label: "Approve optimisation", href: "/dashboard/campaigns" },
            ].map(({ step, label, href }, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <Link
                  href={href}
                  className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3.5 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 hover:text-white"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">{step}</span>
                  {label}
                </Link>
                {i < arr.length - 1 && (
                  <svg className="h-3 w-3 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

function AllocationCard({
  approvalId,
  payload,
}: {
  approvalId: string;
  payload: {
    proposal: AllocationProposal;
    currency: string;
    totalMinor: number;
    proposedTotal: number;
  };
}) {
  const { proposal, currency } = payload;
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${currency}`;

  return (
    <section className="mt-6 rounded-xl border border-amber-300/25 bg-amber-950/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
          Budget reallocation proposed
        </h2>
        <span className="text-xs text-zinc-500">
          total {money(payload.totalMinor)} → {money(payload.proposedTotal)} / day
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{proposal.summary}</p>

      <div className="mt-4 space-y-2">
        {proposal.lines.map((l) => {
          const delta = l.proposedDailyBudgetMinor - l.currentDailyBudgetMinor;
          return (
            <div key={l.campaignId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm">
              <Link href={`/dashboard/campaigns/${l.campaignId}`}
                className="min-w-0 flex-1 truncate font-medium text-zinc-200 hover:underline">
                {l.campaignName}
              </Link>
              <span className="tabular-nums text-zinc-400">
                {money(l.currentDailyBudgetMinor)} → {money(l.proposedDailyBudgetMinor)}
              </span>
              <span className={`text-xs font-semibold tabular-nums ${
                delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-600"
              }`}>
                {delta > 0 ? "+" : ""}{(delta / 100).toFixed(2)}
              </span>
              <p className="w-full text-xs text-zinc-500">{l.rationale}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={approveAllocation}>
          <input type="hidden" name="approvalId" value={approvalId} />
          <button className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
            Approve — apply budgets
          </button>
        </form>
        <form action={rejectAllocation}>
          <input type="hidden" name="approvalId" value={approvalId} />
          <button className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
            Reject
          </button>
        </form>
        <span className="text-xs text-zinc-600">
          Approving updates the real ad-set budgets on Meta for linked campaigns.
        </span>
      </div>
    </section>
  );
}

function WeeklyReportCard({
  report,
  periodStart,
  periodEnd,
}: {
  report: ReportPayload;
  periodStart: string;
  periodEnd: string;
}) {
  const money = (minor: number) =>
    `${(minor / 100).toFixed(2)} ${report.totals?.currency ?? ""}`.trim();

  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          AI weekly report
        </h2>
        <span className="text-xs text-zinc-600">
          {periodStart} → {periodEnd}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{report.summary}</p>

      {report.totals ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Spend", money(report.totals.spendMinor)],
            ["Impressions", report.totals.impressions.toLocaleString("en-US")],
            ["Clicks", report.totals.clicks.toLocaleString("en-US")],
            ["Conversions", report.totals.conversions.toLocaleString("en-US")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([
          ["Highlights", report.highlights, "text-emerald-400"],
          ["Needs attention", report.concerns, "text-amber-400"],
          ["Next week", report.recommendations, "text-sky-400"],
        ] as const).map(([label, items, color]) =>
          items?.length ? (
            <div key={label}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</p>
              <ul className="mt-2 space-y-1.5">
                {items.slice(0, 4).map((item, i) => (
                  <li key={i} className="text-xs leading-relaxed text-zinc-400">• {item}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
  badge,
}: {
  label: string;
  value: number;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="mt-2 text-3xl font-bold tabular-nums">{value}</span>
      {badge ? (
        <span className="mt-1.5 self-start rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-400">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

const ACCENT_STYLES: Record<string, string> = {
  amber: "border-amber-400/20 bg-amber-400/5 text-amber-400",
  violet: "border-violet-400/20 bg-violet-400/5 text-violet-400",
  emerald: "border-emerald-400/20 bg-emerald-400/5 text-emerald-400",
  sky: "border-sky-400/20 bg-sky-400/5 text-sky-400",
  zinc: "border-zinc-700 bg-zinc-800/50 text-zinc-400",
};

function QuickCard({
  tag,
  title,
  description,
  cta,
  href,
  accent,
}: {
  tag: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all hover:border-zinc-600 hover:shadow-xl hover:shadow-black/30"
    >
      <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${ACCENT_STYLES[accent] ?? ACCENT_STYLES.zinc}`}>
        {tag}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      <span className="mt-4 text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
        {cta} →
      </span>
    </Link>
  );
}
