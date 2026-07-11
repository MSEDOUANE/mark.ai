import { config } from "dotenv";

config({ path: ".env.local" });

// Deterministic, low-cost fixtures for browser testing. Safe to re-run: it
// clears prior "TEST —" campaigns first.
async function main() {
  const { db, schema } = await import("./index");
  const { and, eq, like, inArray } = await import("drizzle-orm");

  const [org] = await db.select().from(schema.organizations).limit(1);
  const [membership] = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.orgId, org.id))
    .limit(1);
  const userId = membership?.userId ?? null;

  // ---- clean up previous test data ----
  const prior = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.orgId, org.id), like(schema.campaigns.name, "TEST —%")));
  const priorIds = prior.map((c) => c.id);
  if (priorIds.length) {
    await db.delete(schema.approvals).where(inArray(schema.approvals.entityId, priorIds));
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.campaignId, priorIds));
    await db
      .delete(schema.metricsSnapshots)
      .where(inArray(schema.metricsSnapshots.campaignId, priorIds));
    await db.delete(schema.creatives).where(inArray(schema.creatives.campaignId, priorIds));
    await db.delete(schema.campaigns).where(inArray(schema.campaigns.id, priorIds));
  }

  const [product] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      name: "Argan Glow Serum",
      description: "A lightweight Moroccan argan oil face serum.",
      targetAudience: "Women 25-40 in Morocco interested in natural skincare",
    })
    .returning();

  const strategy = {
    positioning: "Affordable, natural argan skincare for modern Moroccan women.",
    targetAudience: {
      summary: "Women 25-40 in urban Morocco interested in natural beauty.",
      segments: ["Young professionals", "New mothers", "Beauty enthusiasts"],
    },
    channels: [
      { platform: "meta", rationale: "High reach among the target demographic in Morocco." },
      { platform: "tiktok", rationale: "Strong short-video engagement with the younger segment." },
    ],
    keyMessages: [
      "100% natural Moroccan argan",
      "Visible glow in 2 weeks",
      "Cruelty-free & locally made",
    ],
    creatives: [],
  };

  // ---- Draft campaign (for launch-gate test) ----
  const [draft] = await db
    .insert(schema.campaigns)
    .values({
      orgId: org.id,
      productId: product.id,
      platform: "meta",
      name: "TEST — Draft campaign",
      objective: "Drive online sales for the spring launch",
      status: "draft",
      currency: "MAD",
      brief: { productName: "Argan Glow Serum", goal: "Drive online sales", budget: "200 MAD" },
      strategy,
    })
    .returning();

  await db.insert(schema.creatives).values([
    {
      orgId: org.id,
      productId: product.id,
      campaignId: draft.id,
      type: "image",
      status: "ready",
      provider: "mock",
      assetUrl: "https://placehold.co/1080x1920/png?text=Concept+A",
      prompt: "Serum bottle on marble, soft light",
      meta: { concept: "Natural glow", headline: "Glow, naturally", primaryText: "Argan-powered radiance.", callToAction: "Shop Now" },
    },
    {
      orgId: org.id,
      productId: product.id,
      campaignId: draft.id,
      type: "image",
      status: "ready",
      provider: "mock",
      assetUrl: "https://placehold.co/1080x1920/png?text=Concept+B",
      prompt: "Model applying serum, warm tones",
      meta: { concept: "Ritual", headline: "Your daily ritual", primaryText: "Two weeks to visible glow.", callToAction: "Learn More" },
    },
  ]);

  // ---- Active campaign (for metrics + optimization test) ----
  const [active] = await db
    .insert(schema.campaigns)
    .values({
      orgId: org.id,
      productId: product.id,
      platform: "meta",
      name: "TEST — Active campaign",
      objective: "Drive online sales",
      status: "active",
      currency: "MAD",
      budgetMinor: 5000,
      externalIds: { meta: "120000000000000" },
      brief: { budget: "200 MAD" },
      strategy,
    })
    .returning();

  const days = ["2026-06-11", "2026-06-12", "2026-06-13"];
  await db.insert(schema.metricsSnapshots).values(
    days.map((date, i) => ({
      orgId: org.id,
      campaignId: active.id,
      date,
      impressions: 1200 + i * 400,
      clicks: 24 + i * 10,
      spendMinor: 1500 + i * 300,
      conversions: 1 + i,
    })),
  );

  await db.insert(schema.approvals).values({
    orgId: org.id,
    entityType: "optimization",
    entityId: active.id,
    status: "pending",
    requestedBy: userId,
    payload: {
      proposal: {
        action: "scale_up",
        rationale: "CTR is climbing and conversions are trending up — increase budget to capture more demand.",
        suggestedDailyBudgetMinor: 8000,
        confidence: "medium",
      },
    },
  });

  console.log("Seeded test data:");
  console.log("  draft  campaign:", draft.id);
  console.log("  active campaign:", active.id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
