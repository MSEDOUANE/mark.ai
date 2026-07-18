/**
 * Migration: create brand_profile_history (version history for brand edits).
 * Idempotent (IF NOT EXISTS). Run: npx tsx scripts/add-brand-profile-history-table.ts
 * Keep src/db/schema.ts (brandProfileHistory) in sync by hand — no
 * introspection here.
 */
import { config } from "dotenv";
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS brand_profile_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_profile_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      snapshot jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS brand_profile_history_brand_idx
      ON brand_profile_history (brand_profile_id, created_at DESC);
  `);

  console.log("brand_profile_history table + index ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
