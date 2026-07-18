/**
 * Migration: add deleted_at to brand_profiles and products (soft delete, so
 * the delete actions can offer an "Undo" affordance instead of destroying
 * the row immediately). Idempotent (IF NOT EXISTS).
 * Run: npx tsx scripts/add-soft-delete-columns.ts
 * Keep src/db/schema.ts (brandProfiles.deletedAt, products.deletedAt) in
 * sync by hand — no introspection here.
 */
import { config } from "dotenv";
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`);
  await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`);

  console.log("brand_profiles.deleted_at + products.deleted_at ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
