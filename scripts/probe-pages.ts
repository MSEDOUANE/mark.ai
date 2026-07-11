import { config } from "dotenv";

config({ path: ".env.local" });

// READ-ONLY: lists Facebook Pages + token scopes for each connected Meta
// ad account. Creates nothing — used to detect the Page-permission gap before
// a real launch.
async function main() {
  const { db, schema } = await import("../src/db/index");
  const { decryptSecret } = await import("../src/lib/crypto");
  const { MetaCampaignProvider } = await import("../src/lib/ads/meta");
  const { inspectMetaToken } = await import("../src/lib/ads/meta-token");

  const provider = new MetaCampaignProvider();
  const accts = await db.select().from(schema.adAccounts);

  for (const a of accts) {
    if (a.platform !== "meta" || !a.encryptedToken) continue;
    console.log(`\n=== act_${a.externalId} (${a.id}) ===`);
    const token = decryptSecret(a.encryptedToken);
    try {
      const insp = await inspectMetaToken(token);
      console.log("scopes:", (insp?.scopes ?? []).join(", "));
    } catch (e) {
      console.log("scope inspect failed:", e instanceof Error ? e.message : e);
    }
    try {
      const pages = await provider.listPages(token);
      console.log(`pages (${pages.length}):`);
      for (const p of pages) console.log("  -", p.id, p.name);
    } catch (e) {
      console.log("listPages FAILED:", e instanceof Error ? e.message : e);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
