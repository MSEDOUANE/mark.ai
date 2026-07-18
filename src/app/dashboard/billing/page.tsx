import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency}`;

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [[campaignRow], [brandRow], [memberRow], [adAccountRow]] = await Promise.all([
    db
      .select({ campaigns: count() })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id)),
    db
      .select({ brands: count() })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, org.id)),
    db
      .select({ members: count() })
      .from(schema.memberships)
      .where(eq(schema.memberships.orgId, org.id)),
    db
      .select({ adAccounts: count() })
      .from(schema.adAccounts)
      .where(eq(schema.adAccounts.orgId, org.id)),
  ]);

  const spendSummary = await db
    .select({ budgetMinor: schema.campaigns.budgetMinor, currency: schema.campaigns.currency })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.orgId, org.id), eq(schema.campaigns.status, "active")));

  const activeBudgetMinor = spendSummary.reduce(
    (sum, campaign) => sum + (campaign.budgetMinor ?? 0),
    0,
  );
  const currency = spendSummary[0]?.currency ?? "MAD";

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-app-text hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-3 rounded-xl border border-white/10 bg-app-surface/80 p-4 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Credits and invoices are not modeled yet, so this page shows the workspace usage surface and the current cost controls.
          </p>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Active campaigns" value={campaignRow?.campaigns ?? 0} />
          <Card label="Brands" value={brandRow?.brands ?? 0} />
          <Card label="Members" value={memberRow?.members ?? 0} />
          <Card label="Connected ad accounts" value={adAccountRow?.adAccounts ?? 0} />
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">Current managed budget</h2>
          <p className="mt-2 text-sm text-app-text">
            The app manages ad budgets directly in the connected ad accounts. Current active daily budget total: <strong className="text-app-text">{money(activeBudgetMinor, currency)}</strong>.
          </p>
          <p className="mt-2 text-sm text-app-text-muted">
            For plan, invoice, and credit balance management, wire a billing provider here later and keep the page structure intact.
          </p>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/settings" className="rounded-xl border border-white/10 bg-app-surface/80 p-4 hover:border-white/20">
            <div className="text-sm font-semibold text-app-text">Billing controls</div>
            <p className="mt-1 text-sm text-app-text-muted">Connect ad accounts, change autonomy, and manage execution settings.</p>
          </Link>
          <Link href="/dashboard/approvals" className="rounded-xl border border-white/10 bg-app-surface/80 p-4 hover:border-white/20">
            <div className="text-sm font-semibold text-app-text">Approval gate</div>
            <p className="mt-1 text-sm text-app-text-muted">All spend increases and launches stop here before delivery.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-app-surface/80 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-app-text-subtle">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-app-text">{value}</div>
    </div>
  );
}