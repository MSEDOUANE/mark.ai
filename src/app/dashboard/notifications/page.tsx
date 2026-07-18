import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { dismissAlert } from "../alerts-actions";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [alerts, approvals, reports] = await Promise.all([
    db
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
      .limit(12),
    db
      .select({
        id: schema.approvals.id,
        entityType: schema.approvals.entityType,
        entityId: schema.approvals.entityId,
        createdAt: schema.approvals.createdAt,
      })
      .from(schema.approvals)
      .where(and(eq(schema.approvals.orgId, org.id), eq(schema.approvals.status, "pending")))
      .orderBy(desc(schema.approvals.createdAt))
      .limit(8),
    db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.orgId, org.id))
      .orderBy(desc(schema.reports.createdAt))
      .limit(3),
  ]);

  const alertItems = alerts.map((alert) => (
    <div key={alert.id} className="rounded-xl border border-white/10 bg-app-bg px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${alert.severity === "critical" ? "text-red-300" : "text-amber-300"}`}>
            {alert.type}
          </p>
          <p className="mt-1 text-sm text-app-text">{alert.message}</p>
          <p className="mt-1 text-xs text-app-text-subtle">{new Date(alert.createdAt).toLocaleString()}</p>
        </div>
        <form action={dismissAlert}>
          <input type="hidden" name="id" value={alert.id} />
          <button className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-app-text hover:bg-app-surface">
            Dismiss
          </button>
        </form>
      </div>
      <Link href={`/dashboard/campaigns/${alert.campaignId}`} className="mt-2 inline-block text-xs text-app-text-muted hover:text-app-text">
        Open campaign →
      </Link>
    </div>
  ));

  const approvalItems = approvals.map((approval) => (
    <Link
      key={approval.id}
      href={approval.entityType === "budget_allocation" ? "/dashboard" : `/dashboard/campaigns/${approval.entityId}`}
      className="block rounded-xl border border-white/10 bg-app-bg px-4 py-3 hover:border-white/20"
    >
      <p className="text-sm font-medium text-app-text">{approval.entityType.replace(/_/g, " ")}</p>
      <p className="mt-1 text-xs text-app-text-subtle">Waiting since {new Date(approval.createdAt).toLocaleString()}</p>
    </Link>
  ));

  const reportItems = reports.map((report) => (
    <div key={report.id} className="rounded-xl border border-white/10 bg-app-bg px-4 py-3">
      <p className="text-sm text-app-text">
        {report.periodStart} to {report.periodEnd}
      </p>
      <p className="mt-1 text-xs text-app-text-subtle">Published {new Date(report.createdAt).toLocaleString()}</p>
    </div>
  ));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-app-text hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-3 rounded-xl border border-white/10 bg-app-surface/80 p-4 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Alerts, approvals, and report updates stay here so the workspace never loses context.
          </p>
        </div>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Open alerts" emptyText="No open anomaly alerts." items={alertItems} />
          <Panel title="Pending approvals" emptyText="No pending approvals." items={approvalItems} />
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">Recent reports</h2>
          <div className="mt-3 space-y-2">
            {reportItems.length === 0 ? (
              <p className="text-sm text-app-text-muted">No reports yet.</p>
            ) : (
              reportItems
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: ReactNode[];
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-app-surface/80 p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-app-text-muted">{emptyText}</p> : items}
      </div>
    </section>
  );
}