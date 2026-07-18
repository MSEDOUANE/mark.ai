/**
 * Migration: create the library_item_meta table (favorites + folders for the
 * unified Asset Library). Idempotent (IF NOT EXISTS).
 * Run: npx tsx scripts/add-library-item-meta-table.ts
 * Keep src/db/schema.ts (libraryItemMeta) in sync by hand — no introspection here.
 */
import { config } from "dotenv";
// The worktree has no .env.local; use the main checkout's credentials.
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS library_item_meta (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind text NOT NULL,
      item_id uuid NOT NULL,
      favorite boolean NOT NULL DEFAULT false,
      folder text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (org_id, kind, item_id)
    );
  `);

  // Index the Library page's hot query: all meta rows for an org.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS library_item_meta_org_idx
      ON library_item_meta (org_id);
  `);

  console.log("library_item_meta table + index ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
