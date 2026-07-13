"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { getCampaignProvider, type CampaignSpec } from "@/lib/ads";
import {
  upsertDailySnapshot,
  upsertEntityDailySnapshot,
} from "@/lib/ads/metrics-store";
import { decryptSecret } from "@/lib/crypto";
import { queryOptimizationAssistant } from "@/lib/ai/optimizer";
import type { OptimizationProposal } from "@/lib/ai/optimization-schema";
import { parseBudgetMinor } from "@/lib/manager/policy";
import { checkCampaignAnomalies } from "@/lib/ads/alerts-store";
import { executeLaunch, executeOptimization } from "@/lib/manager/execute";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  return { user, org };
}

function resolveReturnPath(formData: FormData, campaignId: string) {
  const fallback = `/dashboard/campaigns/${campaignId}`;
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw.startsWith("/")) return fallback;
  // Allow returning to this campaign (or its subpages) or the approval inbox.
  if (
    raw.startsWith(`/dashboard/campaigns/${campaignId}`) ||
    raw === "/dashboard/approvals"
  ) {
    return raw;
  }
  return fallback;
}

function withError(path: string, message: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}error=${encodeURIComponent(message)}`;
}

export async function prepareLaunch(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const adAccountId = String(formData.get("adAccountId") ?? "");
  const { user, org } = await requireUser();

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.orgId, org.id)))
    .limit(1);
  if (!campaign) redirect("/dashboard/campaigns");
  if (!adAccountId) {
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` +
        encodeURIComponent("Select an ad account to launch with"),
    );
  }

  // Money flows in the selected ad account's real billing currency.
  const [selectedAccount] = await db
    .select({ meta: schema.adAccounts.meta })
    .from(schema.adAccounts)
    .where(and(eq(schema.adAccounts.id, adAccountId), eq(schema.adAccounts.orgId, org.id)))
    .limit(1);
  const acctCurrency =
    ((selectedAccount?.meta ?? {}) as { currency?: string }).currency ??
    campaign.currency;

  const brief = campaign.brief as { budget?: string | null } | null;
  const spec: CampaignSpec = {
    name: campaign.name,
    objective: campaign.objective ?? "traffic",
    dailyBudgetMinor: parseBudgetMinor(brief?.budget, acctCurrency),
    currency: acctCurrency,
  };

  await db.insert(schema.approvals).values({
    orgId: org.id,
    entityType: "campaign_launch",
    entityId: campaignId,
    status: "pending",
    requestedBy: user.id,
    payload: { spec, adAccountId },
  });
  await db
    .update(schema.campaigns)
    .set({
      status: "pending_approval",
      adAccountId,
      currency: acctCurrency,
      updatedAt: new Date(),
    })
    .where(eq(schema.campaigns.id, campaignId));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(`/dashboard/campaigns/${campaignId}`);
}

export async function approveLaunch(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const { user, org } = await requireUser();

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.orgId, org.id)))
    .limit(1);
  if (!approval || approval.status !== "pending") redirect("/dashboard/campaigns");

  const campaignId = approval.entityId;
  const returnTo = resolveReturnPath(formData, campaignId);
  const payload = approval.payload as { spec: CampaignSpec; adAccountId: string };

  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(
      and(
        eq(schema.adAccounts.id, payload.adAccountId),
        eq(schema.adAccounts.orgId, org.id),
      ),
    )
    .limit(1);
  if (!adAccount || !adAccount.encryptedToken) {
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` +
        encodeURIComponent("Ad account is not connected"),
    );
  }

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  if (!campaign) redirect("/dashboard/campaigns");

  try {
    await executeLaunch(campaign, payload.spec, adAccount, "user");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.campaigns)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(schema.campaigns.id, campaignId));
    await db.insert(schema.auditLog).values({
      orgId: org.id,
      campaignId,
      actor: "user",
      action: "campaign_launch_failed",
      payload: { error: message },
    });
    await db
      .update(schema.approvals)
      .set({ status: "approved", approvedBy: user.id, decidedAt: new Date() })
      .where(eq(schema.approvals.id, approvalId));
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` + encodeURIComponent(message),
    );
  }

  await db
    .update(schema.approvals)
    .set({ status: "approved", approvedBy: user.id, decidedAt: new Date() })
    .where(eq(schema.approvals.id, approvalId));

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/approvals");
  redirect(returnTo);
}

export async function rejectLaunch(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const { user, org } = await requireUser();

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.orgId, org.id)))
    .limit(1);
  if (!approval) redirect("/dashboard/campaigns");
  const returnTo = resolveReturnPath(formData, approval.entityId);

  await db
    .update(schema.approvals)
    .set({ status: "rejected", approvedBy: user.id, decidedAt: new Date() })
    .where(eq(schema.approvals.id, approvalId));
  await db
    .update(schema.campaigns)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(schema.campaigns.id, approval.entityId));

  revalidatePath(`/dashboard/campaigns/${approval.entityId}`);
  revalidatePath("/dashboard/approvals");
  redirect(returnTo);
}

// ---------------------------------------------------------------------------
// Optimization loop (Phase 3) — AI recommendation through the same gate.
// ---------------------------------------------------------------------------

export async function requestOptimization(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const returnTo = resolveReturnPath(formData, campaignId);
  const userQuery =
    String(formData.get("userQuery") ?? "").trim() ||
    "What should I do next with this campaign?";
  const { user, org } = await requireUser();

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.orgId, org.id)))
    .limit(1);
  if (!campaign) redirect("/dashboard/campaigns");

  // Analyse the date range the user is viewing (falls back to last 14 days).
  const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const since = String(formData.get("since") ?? "");
  const until = String(formData.get("until") ?? "");
  const conds = [eq(schema.metricsSnapshots.campaignId, campaignId)];
  const ranged = isISO(since) || isISO(until);
  if (isISO(since)) conds.push(gte(schema.metricsSnapshots.date, since));
  if (isISO(until)) conds.push(lte(schema.metricsSnapshots.date, until));
  const metrics = await db
    .select()
    .from(schema.metricsSnapshots)
    .where(and(...conds))
    .orderBy(desc(schema.metricsSnapshots.date))
    .limit(ranged ? 370 : 14);

  try {
    const brief = campaign.brief as { budget?: string | null; audience?: string | null; goal?: string | null } | null;
    const strategy = campaign.strategy as { budgetRationale?: string | null } | null;
    const result = await queryOptimizationAssistant(
      {
        campaignName: campaign.name,
        objective: campaign.objective ?? "traffic",
        currency: campaign.currency,
        currentDailyBudgetMinor: campaign.budgetMinor,
        brief,
        strategyRationale: strategy?.budgetRationale ?? null,
        metrics: metrics
          .map((m) => ({
            date: m.date,
            impressions: m.impressions,
            reach: m.reach,
            clicks: m.clicks,
            linkClicks: m.linkClicks,
            spendMinor: m.spendMinor,
            conversions: m.conversions,
            conversionValueMinor: m.conversionValueMinor,
          }))
          .reverse(),
      },
      userQuery,
    );

    // Only gate an approval when the AI actually proposes a change; a plain
    // question/answer turn shouldn't create something to approve.
    if (result.proposal.action !== "keep") {
      await db.insert(schema.approvals).values({
        orgId: org.id,
        entityType: "optimization",
        entityId: campaignId,
        status: "pending",
        requestedBy: user.id,
        payload: {
          proposal: result.proposal,
          userQuery,
          assistantAnswer: result.answer,
        },
      });
    }
    await db.insert(schema.auditLog).values({
      orgId: org.id,
      campaignId,
      actor: "user",
      action: "optimization_chat",
      payload: {
        userQuery,
        assistantAnswer: result.answer,
        proposal: result.proposal,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(withError(returnTo, `AI recommendation failed: ${message}`));
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/chat`);
  redirect(returnTo);
}

export async function approveOptimization(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const { user, org } = await requireUser();

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.orgId, org.id)))
    .limit(1);
  if (!approval || approval.status !== "pending") redirect("/dashboard/campaigns");

  const campaignId = approval.entityId;
  const returnTo = resolveReturnPath(formData, campaignId);
  const { proposal } = approval.payload as { proposal: OptimizationProposal };

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  if (!campaign) redirect("/dashboard/campaigns");

  try {
    await executeOptimization(campaign, proposal, "user");
    await db
      .update(schema.approvals)
      .set({ status: "approved", approvedBy: user.id, decidedAt: new Date() })
      .where(eq(schema.approvals.id, approvalId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(schema.auditLog).values({
      orgId: org.id,
      campaignId,
      actor: "user",
      action: "optimization_failed",
      payload: { error: message, proposal },
    });
    redirect(withError(returnTo, message));
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/chat`);
  redirect(returnTo);
}

export async function rejectOptimization(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const { user, org } = await requireUser();

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.orgId, org.id)))
    .limit(1);
  if (!approval) redirect("/dashboard/campaigns");
  const returnTo = resolveReturnPath(formData, approval.entityId);

  await db
    .update(schema.approvals)
    .set({ status: "rejected", approvedBy: user.id, decidedAt: new Date() })
    .where(eq(schema.approvals.id, approvalId));

  revalidatePath(`/dashboard/campaigns/${approval.entityId}`);
  revalidatePath(`/dashboard/campaigns/${approval.entityId}/chat`);
  redirect(returnTo);
}

/** Pull the last 7 days of daily metrics from the platform on demand. */
export async function refreshCampaignMetrics(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const { org } = await requireUser();

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.orgId, org.id)))
    .limit(1);
  if (!campaign) redirect("/dashboard/campaigns");

  const externalIds = (campaign.externalIds ?? {}) as Record<string, string>;
  const externalId = externalIds[campaign.platform];
  if (!externalId) {
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` +
        encodeURIComponent("Campaign isn't linked to a platform campaign"),
    );
  }

  // Prefer the linked account; else fall back to any connected account on the
  // same platform (the OAuth user token can read all the user's campaigns) —
  // covers campaigns imported before adAccountId was tracked.
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
  if (!adAccount?.encryptedToken) {
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` +
        encodeURIComponent("Ad account is not connected"),
    );
  }

  const provider = getCampaignProvider(campaign.platform);
  const token = decryptSecret(adAccount.encryptedToken);
  const until = new Date().toISOString().slice(0, 10);
  // Pull up to a year of daily history so the trend charts have data over time
  // (covers campaigns that delivered weeks/months ago and are now paused).
  const since = new Date(Date.now() - 365 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    const daily = await provider.getDailyInsights(
      { externalCampaignId: externalId, since, until },
      token,
    );
    for (const d of daily) {
      await upsertDailySnapshot(org.id, campaignId, d);
    }

    // Per-ad-set and per-ad daily history (for entity-level trends).
    for (const level of ["adset", "ad"] as const) {
      const rows = await provider.getEntityDailyInsights(
        { externalCampaignId: externalId, since, until },
        level,
        token,
      );
      for (const r of rows) {
        await upsertEntityDailySnapshot(org.id, campaignId, r);
      }
    }
  } catch (err) {
    redirect(
      `/dashboard/campaigns/${campaignId}?error=` +
        encodeURIComponent(
          `Metrics refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
    );
  }

  // Manual refresh gets the same immediate anomaly scan as the daily sync.
  await checkCampaignAnomalies(campaignId);

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(`/dashboard/campaigns/${campaignId}`);
}
