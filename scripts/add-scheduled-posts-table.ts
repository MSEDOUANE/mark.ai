/**
 * Migration: create the scheduled_posts table (organic content queue).
 * Idempotent (IF NOT EXISTS). Run: npx tsx scripts/add-scheduled-posts-table.ts
 * Keep src/db/schema.ts (scheduledPosts) in sync by hand — no introspection here.
 */
import { config } from "dotenv";
// The worktree has no .env.local; use the main checkout's credentials.
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      brand_profile_id uuid REFERENCES brand_profiles(id) ON DELETE SET NULL,
      creative_id uuid REFERENCES creatives(id) ON DELETE SET NULL,
      caption text NOT NULL,
      image_url text,
      platform text NOT NULL DEFAULT 'meta_page',
      status text NOT NULL DEFAULT 'scheduled',
      scheduled_for timestamptz NOT NULL,
      published_at timestamptz,
      post_id text,
      permalink text,
      error text,
      created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Index the processor's hot query: due, still-scheduled rows.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS scheduled_posts_due_idx
      ON scheduled_posts (status, scheduled_for);
  `);

  console.log("scheduled_posts table + index ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
