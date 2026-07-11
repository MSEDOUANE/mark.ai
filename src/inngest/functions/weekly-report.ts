import { and, eq, gte, lte } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import {
  generateWeeklyReport,
  type CampaignWeek,
  type ReportPayload,
} from "@/lib/ai/reporter";
import { emailEnabled, sendEmail } from "@/lib/notify/email";
import { orgNotifyEmail } from "@/lib/notify/recipient";
import { reportEmailHtml } from "@/lib/notify/report-email";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The agent's reporting step: every Monday morning (or on demand via
 * `report/generate.requested`) it aggregates each org's last-7-days campaign
 * metrics + management actions, has the AI write the report, and stores it for
 * the Overview page.
 */
export const generateWeeklyReports = inngest.createFunction(
  {
    id: "generate-weekly-reports",
    name: "Weekly AI report",
    retries: 1,
    triggers: [{ cron: "0 8 * * 1" }, { event: "report/generate.requested" }],
  },
  async ({ event, step }) => {
    const periodStart = isoDaysAgo(7);
    const periodEnd = isoDaysAgo(1);

    // On-demand events may target one org; the cron covers all. (Cast: the
    // cron trigger's event.data carries no fields, so the union has no orgId.)
    const eventData = (event?.data ?? {}) as Record<string, unknown>;
    const onlyOrgId =
      typeof eventData.orgId === "string" ? eventData.orgId : null;
    const orgs = onlyOrgId
      ? await db
          .select({ id: schema.organizations.id })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, onlyOrgId))
      : await db.select({ id: schema.organizations.id }).from(schema.organizations);

    let written = 0;
    for (const org of orgs) {
      const campaigns = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.orgId, org.id));
      if (campaigns.length === 0) continue;

      // Aggregate each campaign's snapshots inside the period.
      const weeks: CampaignWeek[] = [];
      for (const c of campaigns) {
        const rows = await db
          .select()
          .from(schema.metricsSnapshots)
          .where(
            and(
              eq(schema.metricsSnapshots.campaignId, c.id),
              gte(schema.metricsSnapshots.date, periodStart),
              lte(schema.metricsSnapshots.date, periodEnd),
            ),
          );
        if (rows.length === 0) continue;
        weeks.push({
          name: c.name,
          status: c.status,
          currency: c.currency,
          spendMinor: rows.reduce((s, r) => s + r.spendMinor, 0),
          impressions: rows.reduce((s, r) => s + r.impressions, 0),
          clicks: rows.reduce((s, r) => s + r.clicks, 0),
          conversions: rows.reduce((s, r) => s + r.conversions, 0),
        });
      }

      const auditRows = await db
        .select({
          action: schema.auditLog.action,
          actor: schema.auditLog.actor,
          createdAt: schema.auditLog.createdAt,
        })
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.orgId, org.id),
            gte(schema.auditLog.createdAt, new Date(`${periodStart}T00:00:00Z`)),
          ),
        );
      const actions = auditRows
        .filter((a) => a.action !== "optimization_chat")
        .map((a) => `${a.action.replace(/_/g, " ")} (${a.actor})`);

      // Nothing delivered and nothing done — skip rather than store an empty report.
      if (weeks.length === 0 && actions.length === 0) continue;

      const ai = await step.run(`report-${org.id}`, () =>
        generateWeeklyReport({ periodStart, periodEnd, campaigns: weeks, actions }),
      );

      const payload: ReportPayload = {
        ...ai,
        totals: {
          spendMinor: weeks.reduce((s, w) => s + w.spendMinor, 0),
          impressions: weeks.reduce((s, w) => s + w.impressions, 0),
          clicks: weeks.reduce((s, w) => s + w.clicks, 0),
          conversions: weeks.reduce((s, w) => s + w.conversions, 0),
          currency: weeks[0]?.currency ?? "USD",
        },
        campaigns: weeks,
        actions,
      };

      await db.insert(schema.reports).values({
        orgId: org.id,
        periodStart,
        periodEnd,
        payload,
      });
      written++;

      // Deliver the digest by email (no-op until RESEND_API_KEY is set).
      if (emailEnabled()) {
        await step.run(`email-${org.id}`, async () => {
          const to = await orgNotifyEmail(org.id);
          if (!to) return { skipped: "no recipient" };
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const sent = await sendEmail({
            to,
            subject: `Your marketing week — ${periodStart} → ${periodEnd}`,
            html: reportEmailHtml(payload, periodStart, periodEnd, appUrl),
          });
          return { sent, to };
        });
      }
    }

    return { written, periodStart, periodEnd };
  },
);
