import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { BriefForm } from "./brief-form";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error } = await searchParams;

  const [brands, productRows, adAccounts] = await Promise.all([
    db
      .select({
        id: schema.brandProfiles.id,
        name: schema.brandProfiles.name,
        primaryColor: schema.brandProfiles.primaryColor,
        logoUrl: schema.brandProfiles.logoUrl,
        websiteUrl: schema.brandProfiles.websiteUrl,
        tone: schema.brandProfiles.tone,
      })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, org.id))
      .orderBy(desc(schema.brandProfiles.createdAt)),

    // Catalog products only — those tied to a brand. Legacy per-campaign
    // products have a null brandProfileId and never appear here.
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        targetAudience: schema.products.targetAudience,
        brandProfileId: schema.products.brandProfileId,
        brand: schema.products.brand,
      })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.orgId, org.id),
          isNotNull(schema.products.brandProfileId),
        ),
      )
      .orderBy(desc(schema.products.createdAt)),

    db
      .select({ meta: schema.adAccounts.meta })
      .from(schema.adAccounts)
      .where(eq(schema.adAccounts.orgId, org.id))
      .limit(1),
  ]);

  // The platform bills in the ad account's currency — surfaced as a hint so
  // budgets aren't typed in a currency the account doesn't use.
  const billingCurrency =
    ((adAccounts[0]?.meta ?? {}) as { currency?: string }).currency ?? null;

  const products = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    targetAudience: p.targetAudience,
    brandProfileId: p.brandProfileId,
    photoUrl: ((p.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null,
  }));

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            ← Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-bold">New campaign brief</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Give the agent a goal — it researches the market, writes the
            strategy, and prepares on-brand creatives.
          </p>
        </div>

        <BriefForm
          brands={brands}
          products={products}
          billingCurrency={billingCurrency}
          error={error}
        />
      </div>
    </main>
  );
}
