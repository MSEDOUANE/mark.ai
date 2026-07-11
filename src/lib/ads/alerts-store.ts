import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { detectAnomalies } from "./anomaly";
import { emailEnabled, sendEmail } from "@/lib/notify/email";
import { orgNotifyEmail } from "@/lib/notify/recipient";
import { alertEmailHtml } from "@/lib/notify/report-email";

/**
 * Run anomaly detection for one campaign against its recent snapshots and
 * persist new alerts. Deduped: while an OPEN alert of the same type exists for
 * the campaign, the condition doesn't re-alert (dismissing re-arms it).
 * Each new alert is also audit-logged so weekly reports pick it up.
 */
export async function checkCampaignAnomalies(campaignId: string): Promise<number> {
  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  if (!campaign) return 0;

  const rows = await db
    .select({
      date: schema.metricsSnapshots.date,
      impressions: schema.metricsSnapshots.impressions,
      clicks: schema.metricsSnapshots.clicks,
      spendMinor: schema.metricsSnapshots.spendMinor,
      conversions: schema.metricsSnapshots.conversions,
    })
    .from(schema.metricsSnapshots)
    .where(eq(schema.metricsSnapshots.campaignId, campaignId))
    .orderBy(desc(schema.metricsSnapshots.date))
    .limit(11);
  if (rows.length < 2) return 0;

  const candidates = detectAnomalies({
    campaignName: campaign.name,
    currency: campaign.currency,
    dailyBudgetMinor: campaign.budgetMinor,
    snapshots: [...rows].reverse(),
  });
  if (candidates.length === 0) return 0;

  const open = await db
    .select({ type: schema.alerts.type })
    .from(schema.alerts)
    .where(
      and(
        eq(schema.alerts.campaignId, campaignId),
        eq(schema.alerts.status, "open"),
      ),
    );
  const openTypes = new Set(open.map((a) => a.type));

  let created = 0;
  for (const c of candidates) {
    if (openTypes.has(c.type)) continue;
    await db.insert(schema.alerts).values({
      orgId: campaign.orgId,
      campaignId,
      type: c.type,
      severity: c.severity,
      message: c.message,
      data: c.data,
    });
    await db.insert(schema.auditLog).values({
      orgId: campaign.orgId,
      campaignId,
      actor: "ai",
      action: `alert_${c.type}`,
      payload: c.data,
    });
    created++;

    // Critical anomalies (spend spike, delivery stop) reach the inbox
    // immediately — money-protecting signals shouldn't wait for a login.
    if (c.severity === "critical" && emailEnabled()) {
      const to = await orgNotifyEmail(campaign.orgId);
      if (to) {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        await sendEmail({
          to,
          subject: `⚠ MarkAI alert: ${c.type.replace(/_/g, " ")} on “${campaign.name}”`,
          html: alertEmailHtml(
            c.message,
            `${appUrl}/dashboard/campaigns/${campaignId}`,
          ),
        });
      }
    }
  }
  return created;
}
