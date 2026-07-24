/**
 * Migration: create video_script_history (version history for a video
 * project's script — snapshot taken before each AI feedback-revision/restore).
 * Idempotent (IF NOT EXISTS). Run: npx tsx scripts/add-video-script-history-table.ts
 * Keep src/db/schema.ts (videoScriptHistory) in sync by hand — no
 * introspection here.
 */
import { config } from "dotenv";
config({ path: "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local", override: true });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS video_script_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_project_id uuid NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      snapshot jsonb NOT NULL,
      feedback text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS video_script_history_project_idx
      ON video_script_history (video_project_id, created_at DESC);
  `);

  console.log("video_script_history table + index ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
