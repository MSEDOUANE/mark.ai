/**
 * Migration: add parent_id + feedback columns to generations, turning each
 * row into a link in a refine chain (feedback -> regenerate -> new row).
 * Idempotent (IF NOT EXISTS). Run: npx tsx scripts/add-generation-thread-columns.ts
 * Keep src/db/schema.ts (generations.parentId/feedback) in sync by hand.
 */
import { config } from "dotenv";
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    ALTER TABLE generations
      ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES generations(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS feedback text;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS generations_parent_idx ON generations (parent_id);
  `);

  console.log("generations.parent_id + generations.feedback ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
