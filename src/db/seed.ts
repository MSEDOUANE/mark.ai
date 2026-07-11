import { config } from "dotenv";

// tsx runs this outside Next.js, so load env before importing the db client
// (which reads DATABASE_URL at module load).
config({ path: ".env.local" });

async function main() {
  const { db, schema } = await import("./index");

  const existing = await db.select().from(schema.organizations).limit(1);
  if (existing.length > 0) {
    console.log("Organization already exists:", existing[0].id, existing[0].name);
    return;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "MarkAI" })
    .returning();

  console.log("Seeded organization:", org.id, org.name);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
