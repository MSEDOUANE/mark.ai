import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    ALTER TABLE video_projects
      ADD COLUMN IF NOT EXISTS music_prompt text
  `);

  console.log("video_projects.music_prompt added.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
