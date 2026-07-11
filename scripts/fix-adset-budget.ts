import { config } from "dotenv";
config({ path: ".env.local" });

const CAMPAIGN_ID = "6c20ab35-0026-4ce1-a8ac-ba16081c9f43";
const AD_ACCOUNT_ID = "664fa5e8-737b-46b7-97f9-f2e92a06a521";
const AD_SET_EXTERNAL_ID = "52512536315647";
const CORRECT_DAILY_BUDGET_MINOR = 10000; // 100 MAD/day (3000 MAD/month ÷ 30)

async function main() {
  const { db, schema } = await import("../src/db/index");
  const { eq } = await import("drizzle-orm");
  const { decryptSecret } = await import("../src/lib/crypto");
  const { MetaCampaignProvider } = await import("../src/lib/ads/meta");

  // Cancel the dangling pending approval.
  await db
    .update(schema.approvals)
    .set({ status: "rejected" })
    .where(eq(schema.approvals.entityId, CAMPAIGN_ID));
  console.log("Pending approvals cancelled.");

  // Get the token for this ad account.
  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(eq(schema.adAccounts.id, AD_ACCOUNT_ID))
    .limit(1);
  if (!adAccount?.encryptedToken) { console.error("No token"); process.exit(1); }
  const token = decryptSecret(adAccount.encryptedToken);

  // Patch the ad set budget on Meta.
  const provider = new MetaCampaignProvider();
  await provider.updateAdSetBudget(AD_SET_EXTERNAL_ID, CORRECT_DAILY_BUDGET_MINOR, token);
  console.log(`Meta ad set ${AD_SET_EXTERNAL_ID} budget updated to ${CORRECT_DAILY_BUDGET_MINOR / 100} MAD/day.`);

  // Sync the DB.
  await db
    .update(schema.campaigns)
    .set({ status: "active", budgetMinor: CORRECT_DAILY_BUDGET_MINOR, updatedAt: new Date() })
    .where(eq(schema.campaigns.id, CAMPAIGN_ID));
  console.log("Campaign status → active, budgetMinor → 10000.");

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
