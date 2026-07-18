import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { CreativeWizard } from "./creative-wizard";

export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campaignId?: string; brandId?: string; photoUrl?: string; template?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error, campaignId: prefillCampaignId, brandId, photoUrl: prefillPhotoUrl, template: prefillTemplate } = await searchParams;

  const [campaigns, brands, productRows] = await Promise.all([
    db
      .select({ id: schema.campaigns.id, name: schema.campaigns.name })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id))
      .orderBy(desc(schema.campaigns.createdAt)),

    db
      .select({ id: schema.brandProfiles.id, name: schema.brandProfiles.name,
                primaryColor: schema.brandProfiles.primaryColor,
                logoUrl: schema.brandProfiles.logoUrl })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, org.id))
      .orderBy(desc(schema.brandProfiles.createdAt)),

    // Catalog products only — those tied to a brand. Legacy per-generation
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
  ]);

  // Flatten the brand jsonb to the photo thumbnail the wizard needs.
  const products = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    targetAudience: p.targetAudience,
    brandProfileId: p.brandProfileId,
    photoUrl: ((p.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null,
  }));

  // If ?brandId= was provided, load the full brand for pre-fill
  let prefillBrand: {
    name: string; primaryColor: string | null; logoUrl: string | null;
    tone: string | null; description: string | null;
  } | null = null;

  if (brandId) {
    const [b] = await db
      .select({
        name: schema.brandProfiles.name,
        primaryColor: schema.brandProfiles.primaryColor,
        logoUrl: schema.brandProfiles.logoUrl,
        tone: schema.brandProfiles.tone,
        description: schema.brandProfiles.description,
      })
      .from(schema.brandProfiles)
      .where(
        and(
          eq(schema.brandProfiles.id, brandId),
          eq(schema.brandProfiles.orgId, org.id),
        ),
      )
      .limit(1);
    if (b) prefillBrand = b;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/dashboard/creatives"
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            ← Creatives
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Generate Ad Creatives</h1>
          <p className="mt-1 text-sm text-zinc-400">
            AI generates 2–4 branded variants, scores each one, and adds
            backgrounds — all in seconds.
          </p>
        </div>

        <CreativeWizard
          campaigns={campaigns}
          savedBrands={brands}
          savedProducts={products}
          prefillCampaignId={prefillCampaignId}
          prefillBrand={prefillBrand}
          prefillPhotoUrl={prefillPhotoUrl}
          prefillTemplate={prefillTemplate}
          error={error}
        />
      </div>
    </main>
  );
}
