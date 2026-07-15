import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pending_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email text NOT NULL,
      role membership_role NOT NULL DEFAULT 'member',
      invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      token text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
    )
  `);

  console.log("pending_invites table created.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
