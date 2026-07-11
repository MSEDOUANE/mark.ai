import { db, schema } from "@/db";
import type { DailyInsight, EntityDailyInsight } from "./provider";

/** Insert or update one day's metrics snapshot (idempotent per campaign+date). */
export async function upsertDailySnapshot(
  orgId: string,
  campaignId: string,
  d: DailyInsight,
) {
  const fields = {
    impressions: d.impressions,
    reach: d.reach,
    clicks: d.clicks,
    linkClicks: d.linkClicks,
    spendMinor: d.spendMinor,
    conversions: d.conversions,
    conversionValueMinor: d.conversionValueMinor,
    raw: (d.raw ?? {}) as Record<string, unknown>,
  };
  await db
    .insert(schema.metricsSnapshots)
    .values({ orgId, campaignId, date: d.date, ...fields })
    .onConflictDoUpdate({
      target: [schema.metricsSnapshots.campaignId, schema.metricsSnapshots.date],
      set: fields,
    });
}

/** Insert or update one ad-set/ad day (idempotent per campaign+level+entity+date). */
export async function upsertEntityDailySnapshot(
  orgId: string,
  campaignId: string,
  d: EntityDailyInsight,
) {
  if (!d.externalId) return;
  const fields = {
    parentExternalId: d.parentExternalId,
    name: d.name,
    impressions: d.impressions,
    reach: d.reach,
    clicks: d.clicks,
    linkClicks: d.linkClicks,
    spendMinor: d.spendMinor,
    conversions: d.conversions,
    conversionValueMinor: d.conversionValueMinor,
    raw: (d.raw ?? {}) as Record<string, unknown>,
  };
  await db
    .insert(schema.entityMetrics)
    .values({
      orgId,
      campaignId,
      level: d.level,
      externalId: d.externalId,
      date: d.date,
      ...fields,
    })
    .onConflictDoUpdate({
      target: [
        schema.entityMetrics.campaignId,
        schema.entityMetrics.level,
        schema.entityMetrics.externalId,
        schema.entityMetrics.date,
      ],
      set: fields,
    });
}
