import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { signOut } from "../login/actions";
import { dismissAlert } from "./alerts-actions";
import { approveAllocation, rejectAllocation } from "./allocation-actions";
import { AUTONOMY_LABELS } from "@/lib/manager/policy";
import { DashboardResetPreferencesButton } from "@/components/dashboard-reset-preferences-button";
import { DashboardSectionOrderer } from "@/components/dashboard-section-orderer";
import { DashboardPrefsSavedChip } from "@/components/dashboard-prefs-saved-chip";
import type { ReportPayload } from "@/lib/ai/reporter";
import type { AllocationProposal } from "@/lib/ai/allocator";

const PANEL_ORDER_DEFAULT = ["performance", "projects", "activity", "workflow"] as const;
type PanelSectionId = (typeof PANEL_ORDER_DEFAULT)[number];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectStatus?: string;
    assetKind?: string;
    projectSort?: string;
    assetSort?: string;
    density?: string;
    focus?: string;
    panelOrder?: string;
    prefsSaved?: string;
  }>;
}) {
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
    recentCampaigns,
    recentCreatives,
    recentGenerations,
    recentBrands,
    recentAuditRows,
    generationStats,
    [{ pendingApprovalsCount }],
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
    db
      .select({
        id: schema.campaigns.id,
        name: schema.campaigns.name,
        status: schema.campaigns.status,
        budgetMinor: schema.campaigns.budgetMinor,
        currency: schema.campaigns.currency,
        updatedAt: schema.campaigns.updatedAt,
      })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id))
      .orderBy(desc(schema.campaigns.updatedAt))
      .limit(5),
    db
      .select({
        id: schema.creatives.id,
        type: schema.creatives.type,
        status: schema.creatives.status,
        meta: schema.creatives.meta,
        createdAt: schema.creatives.createdAt,
      })
      .from(schema.creatives)
      .where(eq(schema.creatives.orgId, org.id))
      .orderBy(desc(schema.creatives.createdAt))
      .limit(6),
    db
      .select({
        id: schema.generations.id,
        tool: schema.generations.tool,
        createdAt: schema.generations.createdAt,
        input: schema.generations.input,
      })
      .from(schema.generations)
      .where(eq(schema.generations.orgId, org.id))
      .orderBy(desc(schema.generations.createdAt))
      .limit(6),
    db
      .select({
        id: schema.brandProfiles.id,
        name: schema.brandProfiles.name,
        tone: schema.brandProfiles.tone,
        updatedAt: schema.brandProfiles.updatedAt,
      })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, org.id))
      .orderBy(desc(schema.brandProfiles.updatedAt))
      .limit(4),
    db
      .select({
        id: schema.auditLog.id,
        actor: schema.auditLog.actor,
        action: schema.auditLog.action,
        payload: schema.auditLog.payload,
        createdAt: schema.auditLog.createdAt,
      })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.orgId, org.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(12),
    Promise.all([
      db
        .select({ n: count() })
        .from(schema.generations)
        .where(eq(schema.generations.orgId, org.id)),
      db
        .select({ n: count() })
        .from(schema.videoProjects)
        .where(eq(schema.videoProjects.orgId, org.id)),
      db
        .select({ n: count() })
        .from(schema.landingPages)
        .where(eq(schema.landingPages.orgId, org.id)),
    ]),
    db
      .select({ pendingApprovalsCount: count() })
      .from(schema.approvals)
      .where(
        and(
          eq(schema.approvals.orgId, org.id),
          eq(schema.approvals.status, "pending"),
        ),
      ),
  ]);

  const [{ n: generationCount }] = generationStats[0];
  const [{ n: videoCount }] = generationStats[1];
  const [{ n: pageCount }] = generationStats[2];
  const {
    projectStatus: rawProjectStatus,
    assetKind: rawAssetKind,
    projectSort: rawProjectSort,
    assetSort: rawAssetSort,
    density: rawDensity,
    focus: rawFocus,
    panelOrder: rawPanelOrder,
    prefsSaved: rawPrefsSaved,
  } = await searchParams;
  const cookieStore = await cookies();
  const cookieProjectStatus = cookieStore.get("dashboard_project_status")?.value;
  const cookieAssetKind = cookieStore.get("dashboard_asset_kind")?.value;
  const cookieProjectSort = cookieStore.get("dashboard_project_sort")?.value;
  const cookieAssetSort = cookieStore.get("dashboard_asset_sort")?.value;
  const cookieDensity = cookieStore.get("dashboard_density")?.value;
  const cookieFocus = cookieStore.get("dashboard_focus")?.value;
  const cookiePanelOrder = cookieStore.get("dashboard_panel_order")?.value;

  const projectStatusFilterValues = [
    "all",
    "active",
    "draft",
    "pending_approval",
    "paused",
  ] as const;
  type ProjectStatusFilter = (typeof projectStatusFilterValues)[number];

  const assetKindFilterValues = ["all", "image", "video"] as const;
  type AssetKindFilter = (typeof assetKindFilterValues)[number];

  const projectSortValues = ["updated", "status", "budget"] as const;
  type ProjectSort = (typeof projectSortValues)[number];

  const assetSortValues = ["updated", "type"] as const;
  type AssetSort = (typeof assetSortValues)[number];

  const densityValues = ["comfortable", "compact"] as const;
  type DensityMode = (typeof densityValues)[number];
  const focusValues = ["operations", "creative"] as const;
  type FocusMode = (typeof focusValues)[number];

  const preferredProjectStatus = rawProjectStatus ?? cookieProjectStatus;
  const preferredAssetKind = rawAssetKind ?? cookieAssetKind;
  const preferredProjectSort = rawProjectSort ?? cookieProjectSort;
  const preferredAssetSort = rawAssetSort ?? cookieAssetSort;
  const preferredDensity = rawDensity ?? cookieDensity;
  const preferredFocus = rawFocus ?? cookieFocus;
  const preferredPanelOrder = rawPanelOrder ?? cookiePanelOrder;

  const projectStatusFilter = projectStatusFilterValues.includes(preferredProjectStatus as ProjectStatusFilter)
    ? (preferredProjectStatus as ProjectStatusFilter)
    : ("all" as ProjectStatusFilter);
  const assetKindFilter = assetKindFilterValues.includes(preferredAssetKind as AssetKindFilter)
    ? (preferredAssetKind as AssetKindFilter)
    : ("all" as AssetKindFilter);
  const projectSort = projectSortValues.includes(preferredProjectSort as ProjectSort)
    ? (preferredProjectSort as ProjectSort)
    : ("updated" as ProjectSort);
  const assetSort = assetSortValues.includes(preferredAssetSort as AssetSort)
    ? (preferredAssetSort as AssetSort)
    : ("updated" as AssetSort);
  const density = densityValues.includes(preferredDensity as DensityMode)
    ? (preferredDensity as DensityMode)
    : ("comfortable" as DensityMode);
  const focus = focusValues.includes(preferredFocus as FocusMode)
    ? (preferredFocus as FocusMode)
    : ("operations" as FocusMode);
  const panelOrder = parsePanelOrder(preferredPanelOrder) ?? [...PANEL_ORDER_DEFAULT];
  const sectionOrder = panelOrder.reduce((acc, id, index) => {
    acc[id] = index + 1;
    return acc;
  }, {} as Record<PanelSectionId, number>);
  const showPrefsSaved = rawPrefsSaved === "1";
  const isCompact = density === "compact";

  const recentConversations = recentAuditRows
    .filter((row) => row.action === "assistant_chat")
    .slice(0, 3)
    .map((row) => {
      const payload = row.payload as { role?: string; content?: string };
      return {
        id: row.id,
        role: payload.role ?? "assistant",
        content: payload.content ?? "Assistant conversation",
        createdAt: row.createdAt,
      };
    });

  const teamActivity = recentAuditRows
    .filter((row) => row.action !== "assistant_chat")
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      createdAt: row.createdAt,
    }));

  const pinnedProjects = recentCampaigns.slice(0, 2);

  const visibleRecentCampaignsBase =
    projectStatusFilter === "all"
      ? recentCampaigns
      : recentCampaigns.filter((project) => project.status === projectStatusFilter);

  const visibleRecentCampaigns = [...visibleRecentCampaignsBase].sort((a, b) => {
    if (projectSort === "status") {
      const byStatus = a.status.localeCompare(b.status);
      if (byStatus !== 0) return byStatus;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    if (projectSort === "budget") {
      const aBudget = a.budgetMinor ?? -1;
      const bBudget = b.budgetMinor ?? -1;
      return bBudget - aBudget;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const visibleRecentCreativesBase =
    assetKindFilter === "all"
      ? recentCreatives
      : recentCreatives.filter((creative) => creative.type === assetKindFilter);

  const visibleRecentCreatives = [...visibleRecentCreativesBase].sort((a, b) => {
    if (assetSort === "type") {
      const byType = a.type.localeCompare(b.type);
      if (byType !== 0) return byType;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  function dashboardHref(next: {
    projectStatus?: ProjectStatusFilter;
    assetKind?: AssetKindFilter;
    projectSort?: ProjectSort;
    assetSort?: AssetSort;
    density?: DensityMode;
    focus?: FocusMode;
    panelOrder?: PanelSectionId[];
  }) {
    const status = next.projectStatus ?? projectStatusFilter;
    const kind = next.assetKind ?? assetKindFilter;
    const pSort = next.projectSort ?? projectSort;
    const aSort = next.assetSort ?? assetSort;
    const densityMode = next.density ?? density;
    const focusMode = next.focus ?? focus;
    const nextPanelOrder = next.panelOrder ?? panelOrder;
    const params = new URLSearchParams();
    if (status !== "all") params.set("projectStatus", status);
    if (kind !== "all") params.set("assetKind", kind);
    if (pSort !== "updated") params.set("projectSort", pSort);
    if (aSort !== "updated") params.set("assetSort", aSort);
    if (densityMode !== "comfortable") params.set("density", densityMode);
    if (focusMode !== "operations") params.set("focus", focusMode);
    if (nextPanelOrder.join(",") !== PANEL_ORDER_DEFAULT.join(",")) {
      params.set("panelOrder", nextPanelOrder.join(","));
    }
    const q = params.toString();
    return q ? `/dashboard?${q}` : "/dashboard";
  }

  function persistentDashboardHref(next: {
    projectStatus?: ProjectStatusFilter;
    assetKind?: AssetKindFilter;
    projectSort?: ProjectSort;
    assetSort?: AssetSort;
    density?: DensityMode;
    focus?: FocusMode;
    panelOrder?: PanelSectionId[];
  }) {
    const target = dashboardHref(next);
    const prefParams = new URLSearchParams();
    prefParams.set("to", target);
    prefParams.set("projectStatus", next.projectStatus ?? projectStatusFilter);
    prefParams.set("assetKind", next.assetKind ?? assetKindFilter);
    prefParams.set("projectSort", next.projectSort ?? projectSort);
    prefParams.set("assetSort", next.assetSort ?? assetSort);
    prefParams.set("density", next.density ?? density);
    prefParams.set("focus", next.focus ?? focus);
    prefParams.set("panelOrder", (next.panelOrder ?? panelOrder).join(","));
    return `/dashboard/preferences?${prefParams.toString()}`;
  }

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
      <div className="mx-auto flex max-w-5xl flex-col">

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

        <nav className="sticky top-2 z-20 mt-3 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {[
              ["performance", "Performance"],
              ["projects", "Projects"],
              ["activity", "Activity"],
              ["workflow", "Workflow"],
            ]
              .sort((a, b) => sectionOrder[a[0] as PanelSectionId] - sectionOrder[b[0] as PanelSectionId])
              .map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
              >
                {label}
              </a>
            ))}
            <span className="mx-1 h-6 w-px self-center bg-zinc-800" />
            {densityValues.map((mode) => (
              <Link
                key={mode}
                href={persistentDashboardHref({ density: mode })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  density === mode
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {mode}
              </Link>
            ))}
            <span className="mx-1 h-6 w-px self-center bg-zinc-800" />
            {focusValues.map((mode) => (
              <Link
                key={mode}
                href={persistentDashboardHref({ focus: mode })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  focus === mode
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {mode}
              </Link>
            ))}
            <span className="mx-1 h-6 w-px self-center bg-zinc-800" />
            {[
              ["New", "/dashboard/campaigns/new"],
              ["Generate", "/dashboard/generate"],
              ["Approvals", "/dashboard/approvals"],
              ["Inbox", "/dashboard/notifications"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
              >
                {label}
              </Link>
            ))}
            <span className="mx-1 h-6 w-px self-center bg-zinc-800" />
            <DashboardResetPreferencesButton
              href="/dashboard/preferences?reset=1&to=/dashboard"
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            />
            <DashboardSectionOrderer
              initialOrder={panelOrder}
              projectStatus={projectStatusFilter}
              assetKind={assetKindFilter}
              projectSort={projectSort}
              assetSort={assetSort}
              density={density}
              focus={focus}
            />
            <DashboardPrefsSavedChip initialVisible={showPrefsSaved} />
          </div>
        </nav>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
          <StatCard label="Campaigns" value={campaignCount} href="/dashboard/campaigns" compact={isCompact} />
          <StatCard label="Creatives" value={creativeCount} href="/dashboard/creatives" compact={isCompact} />
          <StatCard label="Brands" value={brandCount} href="/dashboard/brands" compact={isCompact} />
          <StatCard
            label="Ad accounts"
            value={accountCount}
            href="/dashboard/settings"
            badge={accountCount === 0 ? "Connect" : undefined}
            compact={isCompact}
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

        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/dashboard/campaigns/new"
            accessKey="n"
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600"
            title="Keyboard shortcut: Alt+Shift+N"
          >
            <div className="text-sm font-semibold text-zinc-50">New Campaign</div>
            <div className="mt-1 text-xs text-zinc-500">Shortcut: Alt+Shift+N</div>
          </Link>
          <Link
            href="/dashboard/generate"
            accessKey="g"
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600"
            title="Keyboard shortcut: Alt+Shift+G"
          >
            <div className="text-sm font-semibold text-zinc-50">Open Generate</div>
            <div className="mt-1 text-xs text-zinc-500">Shortcut: Alt+Shift+G</div>
          </Link>
          <Link
            href="/dashboard/assistant"
            accessKey="m"
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600"
            title="Keyboard shortcut: Alt+Shift+M"
          >
            <div className="text-sm font-semibold text-zinc-50">Open Assistant</div>
            <div className="mt-1 text-xs text-zinc-500">Shortcut: Alt+Shift+M</div>
          </Link>
        </section>

        <section id="performance" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 scroll-mt-20" style={{ order: sectionOrder.performance }}>
          <InfoPanel title="Usage Analytics" compact={isCompact}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Campaigns" value={campaignCount} compact={isCompact} />
              <Metric label="Generations" value={generationCount} compact={isCompact} />
              <Metric label="Videos" value={videoCount} compact={isCompact} />
              <Metric label="Pages" value={pageCount} compact={isCompact} />
            </div>
          </InfoPanel>

          <InfoPanel title="Credits Remaining" compact={isCompact}>
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
              Credits are not modeled yet. Wire billing here later and keep this card as the main balance indicator.
            </div>
          </InfoPanel>

          <InfoPanel title="Favorite Brands" compact={isCompact}>
            {recentBrands.length === 0 ? (
              <EmptyText
                text="No brands yet. Create a brand profile to populate this area."
                ctaLabel="Create brand"
                ctaHref="/dashboard/brands/new"
              />
            ) : (
              <div className="space-y-2">
                {recentBrands.map((brand) => (
                  <Link key={brand.id} href="/dashboard/brands" className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                    <div className="text-sm font-semibold text-zinc-50">{brand.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">{brand.tone ?? "No tone set"}</div>
                  </Link>
                ))}
              </div>
            )}
          </InfoPanel>

          <InfoPanel title="Notifications" compact={isCompact}>
            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending approvals</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{pendingApprovalsCount}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Open alerts</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{openAlerts.length}</div>
              </div>
              <Link href="/dashboard/notifications" className="block text-sm font-medium text-amber-300 hover:text-amber-200">
                Open notification inbox →
              </Link>
            </div>
          </InfoPanel>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Quick Generate Buttons</h2>
            <Link href="/dashboard/generate" className="text-xs text-zinc-500 hover:text-zinc-300">
              View all tools →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Ad Image", "/dashboard/generate/image-studio", "Generate image"],
              ["Product Ad", "/dashboard/generate/product-ads", "Build product ad"],
              ["Video", "/dashboard/videos", "Create video"],
              ["Voice", "/dashboard/generate/voice", "Create voiceover"],
            ].map(([label, href, cta]) => (
              <Link key={label} href={href as string}
                className="group rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 transition-colors hover:border-zinc-600">
                <div className="text-sm font-semibold text-zinc-100">{label}</div>
                <div className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-400">{cta}</div>
              </Link>
            ))}
          </div>
        </section>

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

        <section id="projects" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 scroll-mt-20" style={{ order: sectionOrder.projects }}>
          <InfoPanel title="Pinned Projects" compact={isCompact}>
            {pinnedProjects.length === 0 ? (
              <EmptyText text="No pinned projects yet. Most recently active campaigns appear here." />
            ) : (
              <div className="space-y-2">
                {pinnedProjects.map((project) => (
                  <Link key={project.id} href={`/dashboard/campaigns/${project.id}`} className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-50">{project.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">{project.status}</div>
                      </div>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
                        Pinned
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InfoPanel>

          <div className={focus === "creative" ? "lg:order-3" : "lg:order-2"}>
          <InfoPanel title="Recent Projects" compact={isCompact}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {projectStatusFilterValues.map((status) => (
                <Link
                  key={status}
                  href={persistentDashboardHref({ projectStatus: status })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    projectStatusFilter === status
                      ? "border-amber-400 bg-amber-400/10 text-amber-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  {status === "all" ? "All" : status.replace(/_/g, " ")}
                </Link>
              ))}
              <span className="mx-1 h-4 w-px bg-zinc-800" />
              {projectSortValues.map((sort) => (
                <Link
                  key={sort}
                  href={persistentDashboardHref({ projectSort: sort })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    projectSort === sort
                      ? "border-sky-400 bg-sky-400/10 text-sky-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  sort: {sort}
                </Link>
              ))}
            </div>
            {visibleRecentCampaigns.length === 0 ? (
              <EmptyText
                text="No campaigns yet. Start from a brief to create your first project."
                ctaLabel="Start brief"
                ctaHref="/dashboard/campaigns/new"
              />
            ) : (
              <div className="space-y-2">
                {visibleRecentCampaigns.map((project) => (
                  <Link key={project.id} href={`/dashboard/campaigns/${project.id}`} className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-50">{project.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">{project.status}</div>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {project.budgetMinor != null ? `${(project.budgetMinor / 100).toFixed(2)} ${project.currency}` : "No budget"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </InfoPanel>
          </div>

          <div className={focus === "creative" ? "lg:order-2" : "lg:order-3"}>
          <InfoPanel title="Recent AI Generations" compact={isCompact}>
            {recentGenerations.length === 0 ? (
              <EmptyText
                text="No generations yet. Use Generate to create copy, personas, or image assets."
                ctaLabel="Open Generate"
                ctaHref="/dashboard/generate"
              />
            ) : (
              <div className="space-y-2">
                {recentGenerations.map((generation) => {
                  const input = (generation.input ?? {}) as Record<string, unknown>;
                  return (
                    <Link key={generation.id} href={`/dashboard/generate/${generation.tool}`} className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                      <div className="text-sm font-semibold text-zinc-50">{input.productName ? String(input.productName) : generation.tool.replace(/-/g, " ")}</div>
                      <div className="mt-1 text-xs text-zinc-500">{new Date(generation.createdAt).toLocaleString()}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </InfoPanel>
          </div>
        </section>

        <section id="activity" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 scroll-mt-20" style={{ order: sectionOrder.activity }}>
          <div className={focus === "operations" ? "lg:order-2" : "lg:order-1"}>
          <InfoPanel title="Recently Edited Assets" compact={isCompact}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {assetKindFilterValues.map((kind) => (
                <Link
                  key={kind}
                  href={persistentDashboardHref({ assetKind: kind })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    assetKindFilter === kind
                      ? "border-amber-400 bg-amber-400/10 text-amber-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  {kind === "all" ? "All" : kind}
                </Link>
              ))}
              <span className="mx-1 h-4 w-px bg-zinc-800" />
              {assetSortValues.map((sort) => (
                <Link
                  key={sort}
                  href={persistentDashboardHref({ assetSort: sort })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    assetSort === sort
                      ? "border-sky-400 bg-sky-400/10 text-sky-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  sort: {sort}
                </Link>
              ))}
            </div>
            {visibleRecentCreatives.length === 0 ? (
              <EmptyText
                text="No assets yet. Generate or upload creatives to populate this feed."
                ctaLabel="Generate assets"
                ctaHref="/dashboard/generate"
              />
            ) : (
              <div className="space-y-2">
                {visibleRecentCreatives.map((creative) => {
                  const meta = (creative.meta ?? {}) as Record<string, unknown>;
                  const title =
                    typeof meta.headline === "string"
                      ? meta.headline
                      : typeof meta.concept === "string"
                        ? meta.concept
                        : `${creative.type} creative`;
                  return (
                    <Link key={creative.id} href="/dashboard/creatives" className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-50">{title}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {creative.type} · {creative.status} · {new Date(creative.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">Open →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </InfoPanel>
          </div>

          <div className={focus === "operations" ? "lg:order-3" : "lg:order-2"}>
          <InfoPanel title="Recent AI Conversations" compact={isCompact}>
            {recentConversations.length === 0 ? (
              <EmptyText
                text="No assistant chats yet. Open the assistant to start a persistent thread."
                ctaLabel="Open assistant"
                ctaHref="/dashboard/assistant"
              />
            ) : (
              <div className="space-y-2">
                {recentConversations.map((turn) => (
                  <Link key={turn.id} href="/dashboard/assistant" className="block rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-600">
                    <div className="text-sm font-semibold text-zinc-50">{turn.role === "user" ? "You" : "Assistant"}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-zinc-400">{turn.content}</div>
                  </Link>
                ))}
              </div>
            )}
          </InfoPanel>
          </div>

          <div className={focus === "operations" ? "lg:order-1" : "lg:order-3"}>
          <InfoPanel title="Team Activity" compact={isCompact}>
            {teamActivity.length === 0 ? (
              <EmptyText text="No activity yet. Campaign launches and creative actions will appear here." />
            ) : (
              <div className="space-y-2">
                {teamActivity.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="text-sm font-semibold text-zinc-50">{entry.action.replace(/_/g, " ")}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {entry.actor} · {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoPanel>
          </div>
        </section>

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
            compact={isCompact}
          />
          <QuickCard
            tag="Generate"
            title="AI assets"
            description="Ad creatives, copy, social captions, and buyer personas."
            cta="Browse tools"
            href="/dashboard/generate"
            accent="violet"
            compact={isCompact}
          />
          <QuickCard
            tag="Brand"
            title="Brand profiles"
            description="Save your logo, colors, and tone to reuse across every creative."
            cta="Manage brands"
            href="/dashboard/brands"
            accent="emerald"
            compact={isCompact}
          />
          <QuickCard
            tag="Library"
            title="All creatives"
            description="Review scored creatives, download assets, and track generation status."
            cta="View creatives"
            href="/dashboard/creatives"
            accent="sky"
            compact={isCompact}
          />
          <QuickCard
            tag="Monitor"
            title="Campaign library"
            description="Review live and drafted campaigns and request optimization."
            cta="View campaigns"
            href="/dashboard/campaigns"
            accent="zinc"
            compact={isCompact}
          />
          <QuickCard
            tag="Configure"
            title="Settings"
            description="Connect ad accounts, set Meta OAuth, and manage AI autonomy."
            cta="Open settings"
            href="/dashboard/settings"
            accent="zinc"
            compact={isCompact}
          />
          <QuickCard
            tag="Admin"
            title="Billing"
            description="Track workspace usage, active budgets, and the future credits and invoices surface."
            cta="Open billing"
            href="/dashboard/billing"
            accent="amber"
            compact={isCompact}
          />
          <QuickCard
            tag="Admin"
            title="Team"
            description="Invite members, change roles, and keep approvals and access visible."
            cta="Open team"
            href="/dashboard/team"
            accent="emerald"
            compact={isCompact}
          />
          <QuickCard
            tag="Admin"
            title="Notifications"
            description="Review alerts, approvals, and report updates in one inbox."
            cta="Open inbox"
            href="/dashboard/notifications"
            accent="sky"
            compact={isCompact}
          />
          <QuickCard
            tag="Admin"
            title="Profile"
            description="Check your account identity and workspace access details."
            cta="View profile"
            href="/dashboard/profile"
            accent="violet"
            compact={isCompact}
          />
        </div>

        {/* Workflow steps */}
        <section id="workflow" className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 scroll-mt-20" style={{ order: sectionOrder.workflow }}>
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

function InfoPanel({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/60 ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-950/60 ${compact ? "px-3 py-1.5" : "px-3 py-2"}`}>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`${compact ? "mt-0.5 text-base" : "mt-1 text-lg"} font-semibold tabular-nums text-zinc-100`}>{value}</div>
    </div>
  );
}

function EmptyText({
  text,
  ctaLabel,
  ctaHref,
}: {
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-sm text-zinc-500">{text}</p>
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="mt-3 inline-block text-sm font-medium text-amber-300 hover:text-amber-200">
          {ctaLabel} →
        </Link>
      ) : null}
    </div>
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
  compact,
}: {
  label: string;
  value: number;
  href: string;
  badge?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-zinc-600 hover:bg-zinc-900 ${compact ? "p-3" : "p-4"}`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`${compact ? "mt-1.5 text-2xl" : "mt-2 text-3xl"} font-bold tabular-nums`}>{value}</span>
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

function parsePanelOrder(value: string | undefined): PanelSectionId[] | null {
  if (!value) return null;
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length !== PANEL_ORDER_DEFAULT.length) return null;
  if (new Set(ids).size !== PANEL_ORDER_DEFAULT.length) return null;
  if (!ids.every((id) => PANEL_ORDER_DEFAULT.includes(id as PanelSectionId))) return null;
  return ids as PanelSectionId[];
}

function QuickCard({
  tag,
  title,
  description,
  cta,
  href,
  accent,
  compact,
}: {
  tag: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all hover:border-zinc-600 hover:shadow-xl hover:shadow-black/30 ${compact ? "p-4" : "p-5"}`}
    >
      <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${ACCENT_STYLES[accent] ?? ACCENT_STYLES.zinc}`}>
        {tag}
      </span>
      <h3 className={`${compact ? "mt-2" : "mt-3"} font-semibold`}>{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      <span className={`${compact ? "mt-3" : "mt-4"} text-sm font-medium text-zinc-300 group-hover:text-white transition-colors`}>
        {cta} →
      </span>
    </Link>
  );
}
