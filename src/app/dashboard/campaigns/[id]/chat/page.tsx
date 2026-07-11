import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { getCampaignProvider } from "@/lib/ads";
import { decryptSecret } from "@/lib/crypto";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import {
  approveOptimization,
  rejectOptimization,
  requestOptimization,
} from "../actions";

type OptimizationChatPayload = {
  userQuery?: string;
  assistantAnswer?: string;
  proposal?: OptimizationProposal;
};

function money(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

const panelClass = "rounded-lg border border-zinc-800 bg-zinc-900 p-4";
const fieldClass =
  "rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none focus:border-amber-300";
const primaryButtonClass =
  "rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100";
const secondaryButtonClass =
  "rounded-full border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 hover:border-white/20";

export default async function CampaignChatPage({
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

  const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = new Date().toISOString().slice(0, 10);
  const hasCustom = isISO(since) || isISO(until);
  const presetDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
  const rangeUntil = isISO(until) ? (until as string) : today;
  const rangeSince = isISO(since)
    ? (since as string)
    : // eslint-disable-next-line react-hooks/purity -- per-request server component; "now" is intentional
      new Date(Date.now() - presetDays * 86_400_000).toISOString().slice(0, 10);

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

  const [pendingApprovals, audit] = await Promise.all([
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
      .from(schema.auditLog)
      .where(eq(schema.auditLog.campaignId, id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(30),
  ]);

  const pendingOptimization = pendingApprovals.find(
    (a) => a.entityType === "optimization",
  );
  const optimizationPayload = pendingOptimization
    ? (pendingOptimization.payload as {
        proposal: OptimizationProposal;
        userQuery?: string;
        assistantAnswer?: string;
      })
    : null;
  const optimization = optimizationPayload?.proposal ?? null;
  const optimizationChats = audit
    .filter((a) => a.action === "optimization_chat")
    .map((a) => a.payload as OptimizationChatPayload);

  const isLive = campaign.status === "active" || campaign.status === "paused";
  const returnTo = `/dashboard/campaigns/${campaign.id}/chat`;

  // For a scale recommendation, fetch the targeted ad set's REAL current daily
  // budget from Meta so the "Changes to apply" preview shows an accurate
  // current → new (the stored campaign budget can be stale).
  const extIds = (campaign.externalIds ?? {}) as Record<string, string>;
  const isScale =
    optimization?.action === "scale_up" ||
    optimization?.action === "scale_down";
  let currentAdSetBudgetMinor: number | null = campaign.budgetMinor;
  if (isScale && extIds.metaAdSet) {
    const [adAccount] = campaign.adAccountId
      ? await db
          .select()
          .from(schema.adAccounts)
          .where(eq(schema.adAccounts.id, campaign.adAccountId))
          .limit(1)
      : await db
          .select()
          .from(schema.adAccounts)
          .where(
            and(
              eq(schema.adAccounts.orgId, org.id),
              eq(schema.adAccounts.platform, campaign.platform),
            ),
          )
          .limit(1);
    if (adAccount?.encryptedToken) {
      try {
        const info = await getCampaignProvider(campaign.platform).getAdSet(
          extIds.metaAdSet,
          decryptSecret(adAccount.encryptedToken),
        );
        if (info?.dailyBudgetMinor != null) {
          currentAdSetBudgetMinor = info.dailyBudgetMinor;
        }
      } catch {
        // fall back to the stored budget on any error
      }
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href={`/dashboard/campaigns/${campaign.id}`} className="text-sm text-zinc-300 hover:text-white">
          ← Campaign detail
        </Link>

        <header className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Optimization chat</h1>
            <p className="text-sm text-zinc-300">
              {campaign.name} · {campaign.status}
            </p>
          </div>
        </header>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/25 bg-red-950/45 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {/* Conversation thread (oldest → newest) */}
        <section className="mt-5 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Conversation</h2>
          {optimizationChats.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-300">
              No messages yet — ask MarkAI about this campaign below.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {[...optimizationChats].reverse().map((chat, index) => (
                <div key={index} className="space-y-2">
                  {chat.userQuery ? (
                    <div className="ml-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-50 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
                        You
                      </div>
                      <p className="mt-2 leading-7">{chat.userQuery}</p>
                    </div>
                  ) : null}
                  {chat.assistantAnswer ? (
                    <div className="max-w-2xl rounded-xl border border-amber-300/20 bg-zinc-950 p-4 text-sm text-zinc-50 shadow-[0_0_0_1px_rgba(251,191,36,0.04)]">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200">
                        MarkAI
                      </div>
                      <p className="mt-2 leading-7">{chat.assistantAnswer}</p>
                      {chat.proposal && chat.proposal.action !== "keep" ? (
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-200">
                          Proposed: {chat.proposal.action.replace("_", " ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approval gate — only when MarkAI proposed an actionable change */}
        {isLive && optimization && pendingOptimization ? (
          <section className="mt-5 rounded-xl border border-amber-300/30 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-100">
              ⏸ MarkAI proposed an action — review the change and approve before
              anything updates on Meta.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-zinc-400">Action</dt>
              <dd className="font-medium uppercase">{optimization.action}</dd>
              <dt className="text-zinc-400">Confidence</dt>
              <dd>{optimization.confidence}</dd>
            </dl>

            {(() => {
              const ext = (campaign.externalIds ?? {}) as Record<string, string>;
              const a = optimization.action;
              const lines: string[] = [];
              let reachesMeta = false;
              if (a === "scale_up" || a === "scale_down") {
                reachesMeta = Boolean(campaign.adAccountId && ext.metaAdSet);
                const from =
                  currentAdSetBudgetMinor != null
                    ? money(currentAdSetBudgetMinor, campaign.currency)
                    : "current";
                const to =
                  optimization.suggestedDailyBudgetMinor != null
                    ? money(optimization.suggestedDailyBudgetMinor, campaign.currency)
                    : "—";
                lines.push(`Ad-set daily budget: ${from} → ${to}`);
              } else if (a === "pause") {
                reachesMeta = Boolean(campaign.adAccountId && ext[campaign.platform]);
                lines.push(
                  `Pause “${campaign.name}” on Meta — spend stops until you resume it.`,
                );
              } else if (a === "kill") {
                reachesMeta = Boolean(campaign.adAccountId && ext[campaign.platform]);
                lines.push(
                  `Stop “${campaign.name}” — pause it on Meta and mark it completed.`,
                );
              } else if (a === "refresh_creatives") {
                lines.push(
                  "Generate fresh ad creative variants for this campaign — new hooks and scenes, written in your brand voice. No budget or delivery change.",
                );
              } else if (a === "declare_winner") {
                reachesMeta = Boolean(campaign.adAccountId);
                const loserCount = optimization.loserAdIds?.length ?? 0;
                lines.push(
                  `A/B test verdict: pause ${loserCount} losing ad variant${loserCount !== 1 ? "s" : ""} — the winner keeps the full ad-set budget. Spend is unchanged.`,
                );
              } else {
                lines.push("No changes — keeps the current budget and status.");
              }
              return (
                <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-950/25 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                    Changes to apply
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-50">
                    {lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-zinc-300">
                    {a === "keep" || a === "refresh_creatives"
                      ? "Nothing will be sent to Meta."
                      : reachesMeta
                        ? "✓ Approving applies this to your live campaign on Meta."
                        : "ⓘ Not linked to an ad account — approving updates MarkAI only, not Meta."}
                  </p>
                </div>
              );
            })()}

            <div className="mt-4 flex flex-wrap gap-3">
              <form action={approveOptimization}>
                <input type="hidden" name="approvalId" value={pendingOptimization.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className={primaryButtonClass}>Approve</button>
              </form>
              <form action={rejectOptimization}>
                <input type="hidden" name="approvalId" value={pendingOptimization.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className={secondaryButtonClass}>Reject</button>
              </form>
            </div>
          </section>
        ) : null}

        {/* Message input — always available so the conversation can continue */}
        {isLive ? (
          <section className="mt-5 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
            <form action={requestOptimization} className="space-y-3">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input type="hidden" name="since" value={rangeSince} />
              <input type="hidden" name="until" value={rangeUntil} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="block">
                <span className="text-sm text-zinc-300">
                  Ask MarkAI about this campaign
                </span>
                <textarea
                  name="userQuery"
                  rows={3}
                  className={`${fieldClass} mt-2 min-h-24 w-full resize-y`}
                  placeholder="Example: How is my CTR trending? Should I scale, pause, or keep it?"
                />
              </label>
              <button className={primaryButtonClass}>Send</button>
            </form>
            <p className="mt-2 text-xs text-zinc-400">
              Analyses the selected range: {rangeSince} → {rangeUntil}
              {hasCustom ? " (custom)" : ""}
            </p>
          </section>
        ) : (
          <p className="mt-5 text-sm text-zinc-300">
            Optimization chat is available once the campaign is active or paused.
          </p>
        )}
      </div>
    </main>
  );
}
