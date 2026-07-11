import { config } from "dotenv";
config({ path: ".env.local" });

const CAMPAIGN_ID = "6c20ab35-0026-4ce1-a8ac-ba16081c9f43";

async function main() {
  const { db, schema } = await import("../src/db/index");
  const { eq } = await import("drizzle-orm");

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, CAMPAIGN_ID))
    .limit(1);
  if (!campaign) { console.error("Campaign not found"); process.exit(1); }

  console.log("Current status:", campaign.status);

  // Reset campaign status.
  await db
    .update(schema.campaigns)
    .set({ status: "pending_approval", updatedAt: new Date() })
    .where(eq(schema.campaigns.id, CAMPAIGN_ID));

  // Get latest approval payload to reuse the spec.
  const approvals = await db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.entityId, CAMPAIGN_ID))
    .orderBy(schema.approvals.createdAt);

  const latest = approvals.at(-1);
  if (!latest) { console.error("No approval found to clone spec from"); process.exit(1); }

  // Recompute budget correctly (monthly → daily) before inserting fresh approval.
  const { parseBudgetMinor } = await import("../src/lib/manager/policy");
  const brief = (campaign.brief ?? {}) as { budget?: string };
  const correctedBudget = parseBudgetMinor(brief.budget);
  const oldPayload = latest.payload as { spec: Record<string, unknown>; adAccountId: string };
  const newPayload = {
    ...oldPayload,
    spec: { ...oldPayload.spec, dailyBudgetMinor: correctedBudget },
  };
  console.log(`Budget: ${correctedBudget} minor units (${correctedBudget / 100} MAD/day)`);

  // Insert a fresh pending approval with the corrected spec payload.
  const [newApproval] = await db
    .insert(schema.approvals)
    .values({
      orgId: campaign.orgId,
      entityType: "campaign_launch",
      entityId: CAMPAIGN_ID,
      status: "pending",
      requestedBy: latest.requestedBy,
      payload: newPayload,
    })
    .returning();

  console.log("Campaign reset to pending_approval.");
  console.log("New approval id:", newApproval.id);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
