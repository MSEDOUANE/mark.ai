import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    ALTER TABLE brand_profiles
      ADD COLUMN IF NOT EXISTS font_family text,
      ADD COLUMN IF NOT EXISTS secondary_color text,
      ADD COLUMN IF NOT EXISTS accent_color text,
      ADD COLUMN IF NOT EXISTS assets jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS default_template text,
      ADD COLUMN IF NOT EXISTS voice_notes text
  `);

  console.log("brand_profiles: font_family, secondary_color, accent_color, assets, default_template, voice_notes added.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
