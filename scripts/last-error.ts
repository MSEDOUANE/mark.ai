import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db, schema } = await import("../src/db/index");
  const { desc, eq } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.action, "campaign_launch_failed"))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(3);

  for (const r of rows) {
    console.log("---");
    console.log("time:", r.createdAt);
    console.log("campaignId:", r.campaignId);
    console.log("error:", JSON.stringify(r.payload, null, 2));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
