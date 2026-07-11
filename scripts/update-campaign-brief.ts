import { config } from "dotenv";

config({ path: ".env.local" });

const CAMPAIGN_ID = "6c20ab35-0026-4ce1-a8ac-ba16081c9f43";
const WEBSITE_URL = "https://www.noorattan.com/";
const GEO_COUNTRIES = ["MA"];

async function main() {
  const { db, schema } = await import("../src/db/index");
  const { eq } = await import("drizzle-orm");

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, CAMPAIGN_ID));

  if (!campaign) {
    console.error("Campaign not found:", CAMPAIGN_ID);
    process.exit(1);
  }

  console.log("Current brief:", JSON.stringify(campaign.brief, null, 2));

  const updatedBrief = {
    ...(campaign.brief as Record<string, unknown>),
    websiteUrl: WEBSITE_URL,
    geoCountries: GEO_COUNTRIES,
  };

  await db
    .update(schema.campaigns)
    .set({ brief: updatedBrief })
    .where(eq(schema.campaigns.id, CAMPAIGN_ID));

  console.log("\nUpdated brief:", JSON.stringify(updatedBrief, null, 2));
  console.log("\nDone — campaign is now launch-ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
