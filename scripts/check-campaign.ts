import { config } from "dotenv";
config({ path: ".env.local" });

const CAMPAIGN_ID = "6c20ab35-0026-4ce1-a8ac-ba16081c9f43";

async function main() {
  const { db, schema } = await import("../src/db/index");
  const { eq } = await import("drizzle-orm");

  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, CAMPAIGN_ID)).limit(1);
  console.log("status:", c.status);
  console.log("externalIds:", JSON.stringify(c.externalIds, null, 2));
  console.log("budgetMinor:", c.budgetMinor, "(", (c.budgetMinor ?? 0) / 100, "MAD/day )");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
