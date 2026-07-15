import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    ALTER TABLE landing_pages
      ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ar'
  `);

  console.log("landing_pages.language added.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
