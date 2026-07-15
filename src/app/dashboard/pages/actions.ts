"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { generateLandingContent } from "@/lib/ai/landing";

function clean(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

/** Generate an on-brand landing page for a catalog product (or free text). */
export async function createLandingPage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const fail = (msg: string) =>
    redirect("/dashboard/pages?error=" + encodeURIComponent(msg));

  const productId = clean(formData, "productId");
  const productNameInput = clean(formData, "productName");
  const ctaKind = clean(formData, "ctaKind") === "whatsapp" ? "whatsapp" : "link";
  const whatsappNumber = (clean(formData, "whatsappNumber") ?? "").replace(/[^\d]/g, "");
  const ctaUrl = clean(formData, "ctaUrl");

  // Resolve CTA destination.
  let ctaHref: string;
  if (ctaKind === "whatsapp") {
    if (!whatsappNumber) fail("Enter the WhatsApp number (with country code).");
    ctaHref = `https://wa.me/${whatsappNumber}`;
  } else {
    if (!ctaUrl) fail("Enter the CTA link URL.");
    ctaHref = ctaUrl!;
  }

  // Resolve product + its brand.
  let product: typeof schema.products.$inferSelect | undefined;
  if (productId) {
    [product] = await db
      .select()
      .from(schema.products)
      .where(
        and(eq(schema.products.id, productId), eq(schema.products.orgId, org.id)),
      )
      .limit(1);
  }
  const productName = product?.name ?? productNameInput;
  if (!productName) fail("Pick a product or type a product name.");

  let brand: typeof schema.brandProfiles.$inferSelect | undefined;
  if (product?.brandProfileId) {
    [brand] = await db
      .select()
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.id, product.brandProfileId))
      .limit(1);
  }
  const visuals = (product?.brand ?? {}) as {
    primaryColor?: string | null;
    accentColor?: string | null;
    logoUrl?: string | null;
    photoUrl?: string | null;
  };

  const language = clean(formData, "language") ?? "ar";
  const dialect = clean(formData, "dialect");

  try {
    const content = await generateLandingContent({
      productName: productName!,
      productDescription: clean(formData, "productDescription") ?? product?.description,
      audience: product?.targetAudience,
      brandName: brand?.name,
      brandDescription: brand?.description,
      tone: brand?.tone,
      ctaKind,
      language,
      dialect,
    });

    const [page] = await db
      .insert(schema.landingPages)
      .values({
        orgId: org.id,
        productId: product?.id ?? null,
        brandProfileId: product?.brandProfileId ?? null,
        slug: slugify(productName!),
        title: productName!,
        content,
        brand: {
          primaryColor: brand?.primaryColor ?? visuals.primaryColor ?? null,
          accentColor: visuals.accentColor ?? null,
          logoUrl: brand?.logoUrl ?? visuals.logoUrl ?? null,
          photoUrl: visuals.photoUrl ?? null,
        },
        ctaHref,
        language,
      })
      .returning();

    revalidatePath("/dashboard/pages");
    redirect(`/dashboard/pages?created=${page.slug}`);
  } catch (err) {
    // Next redirects throw — let them through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    fail(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function deleteLandingPage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "id");
  if (!id) return;
  await db
    .delete(schema.landingPages)
    .where(
      and(eq(schema.landingPages.id, id), eq(schema.landingPages.orgId, org.id)),
    );
  revalidatePath("/dashboard/pages");
}
