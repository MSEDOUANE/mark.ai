import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import {
  approveLaunch,
  rejectLaunch,
  approveOptimization,
  rejectOptimization,
} from "../campaigns/[id]/actions";
import { approveAllocation, rejectAllocation } from "../allocation-actions";
import type { CampaignSpec } from "@/lib/ads";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import type { AllocationProposal } from "@/lib/ai/allocator";

const RETURN_TO = "/dashboard/approvals";

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency}`;

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const approvals = await db
    .select()
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.orgId, org.id),
        eq(schema.approvals.status, "pending"),
      ),
    )
    .orderBy(desc(schema.approvals.createdAt));

  // Map campaign ids → names for launch/optimization previews.
  const campaignIds = approvals
    .filter((a) => a.entityType !== "budget_allocation")
    .map((a) => a.entityId);
  const campaigns = campaignIds.length
    ? await db
        .select({ id: schema.campaigns.id, name: schema.campaigns.name })
        .from(schema.campaigns)
        .where(inArray(schema.campaigns.id, campaignIds))
    : [];
  const nameOf = (id: string) =>
    campaigns.find((c) => c.id === id)?.name ?? "Campaign";

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="mt-1 text-sm text-app-text-muted">
          Every decision that spends or changes your live campaigns waits here.
          Nothing reaches Meta until you approve it.
        </p>

        {approvals.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold">You&apos;re all caught up</h2>
            <p className="mt-2 max-w-sm text-sm text-app-text-subtle">
              No pending approvals. When the agent proposes a launch, an
              optimization, or a budget change, it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {approvals.map((a) => {
              if (a.entityType === "campaign_launch") {
                const { spec } = a.payload as { spec: CampaignSpec };
                return (
                  <ApprovalCard
                    key={a.id}
                    tag="Launch"
                    tagClass="bg-amber-400/15 text-amber-300"
                    title={nameOf(a.entityId)}
                    href={`/dashboard/campaigns/${a.entityId}`}
                    lines={[
                      `Objective: ${spec.objective}`,
                      `Daily budget: ${money(spec.dailyBudgetMinor, spec.currency)}`,
                    ]}
                    note="Approving creates the full campaign on Meta (paused) and starts delivery when you enable it."
                    approve={approveLaunch}
                    reject={rejectLaunch}
                    approvalId={a.id}
                    approveLabel="Approve & launch"
                  />
                );
              }
              if (a.entityType === "optimization") {
                const { proposal } = a.payload as { proposal: OptimizationProposal };
                return (
                  <ApprovalCard
                    key={a.id}
                    tag="Optimization"
                    tagClass="bg-sky-400/15 text-sky-300"
                    title={nameOf(a.entityId)}
                    href={`/dashboard/campaigns/${a.entityId}/chat`}
                    lines={[
                      `Action: ${proposal.action.replace(/_/g, " ")}`,
                      proposal.rationale,
                    ]}
                    approve={approveOptimization}
                    reject={rejectOptimization}
                    approvalId={a.id}
                    approveLabel="Approve"
                  />
                );
              }
              if (a.entityType === "budget_allocation") {
                const { proposal, currency } = a.payload as {
                  proposal: AllocationProposal;
                  currency: string;
                };
                return (
                  <ApprovalCard
                    key={a.id}
                    tag="Budget"
                    tagClass="bg-emerald-400/15 text-emerald-300"
                    title="Cross-campaign reallocation"
                    href="/dashboard"
                    lines={[
                      proposal.summary,
                      ...proposal.lines.map(
                        (l) =>
                          `${l.campaignName}: ${money(l.currentDailyBudgetMinor, currency)} → ${money(l.proposedDailyBudgetMinor, currency)}`,
                      ),
                    ]}
                    note="Approving applies the new ad-set budgets on Meta for linked campaigns."
                    approve={approveAllocation}
                    reject={rejectAllocation}
                    approvalId={a.id}
                    approveLabel="Approve — apply budgets"
                    noReturnTo
                  />
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function ApprovalCard({
  tag,
  tagClass,
  title,
  href,
  lines,
  note,
  approve,
  reject,
  approvalId,
  approveLabel,
  noReturnTo = false,
}: {
  tag: string;
  tagClass: string;
  title: string;
  href: string;
  lines: string[];
  note?: string;
  approve: (formData: FormData) => void;
  reject: (formData: FormData) => void;
  approvalId: string;
  approveLabel: string;
  noReturnTo?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tagClass}`}>
          {tag}
        </span>
        <Link href={href} className="min-w-0 flex-1 truncate font-semibold text-app-text hover:underline">
          {title}
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {lines.filter(Boolean).map((l, i) => (
          <li key={i} className="text-sm leading-relaxed text-app-text">{l}</li>
        ))}
      </ul>

      {note ? <p className="mt-3 text-xs text-app-text-subtle">{note}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <form action={approve}>
          <input type="hidden" name="approvalId" value={approvalId} />
          {!noReturnTo ? <input type="hidden" name="returnTo" value={RETURN_TO} /> : null}
          <button className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
            {approveLabel}
          </button>
        </form>
        <form action={reject}>
          <input type="hidden" name="approvalId" value={approvalId} />
          {!noReturnTo ? <input type="hidden" name="returnTo" value={RETURN_TO} /> : null}
          <button className="rounded-xl border border-app-border-strong px-5 py-2.5 text-sm text-app-text transition-colors hover:border-zinc-500 hover:text-app-text">
            Reject
          </button>
        </form>
      </div>
    </section>
  );
}
