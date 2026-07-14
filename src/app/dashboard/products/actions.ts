"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

function clean(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

export async function saveProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const name = clean(formData, "name");
  if (!name) {
    redirect(
      "/dashboard/products/new?error=" + encodeURIComponent("Product name is required"),
    );
  }

  const id = clean(formData, "id"); // present when editing
  const brandProfileId = clean(formData, "brandProfileId");
  const description = clean(formData, "description");
  const targetAudience = clean(formData, "targetAudience");
  const photoUrl = clean(formData, "photoUrl");

  // Verify the brand (if given) belongs to this org before linking it.
  if (brandProfileId) {
    const [owned] = await db
      .select({ id: schema.brandProfiles.id })
      .from(schema.brandProfiles)
      .where(
        and(
          eq(schema.brandProfiles.id, brandProfileId),
          eq(schema.brandProfiles.orgId, org.id),
        ),
      )
      .limit(1);
    if (!owned) {
      redirect(
        "/dashboard/products/new?error=" + encodeURIComponent("Brand not found"),
      );
    }
  }

  if (id) {
    const [existing] = await db
      .select({ id: schema.products.id, brand: schema.products.brand })
      .from(schema.products)
      .where(and(eq(schema.products.id, id), eq(schema.products.orgId, org.id)))
      .limit(1);
    if (!existing) redirect("/dashboard/products");

    const prevBrand = (existing.brand ?? {}) as Record<string, unknown>;
    await db
      .update(schema.products)
      .set({
        name: name!,
        brandProfileId: brandProfileId ?? null,
        description,
        targetAudience,
        brand: { ...prevBrand, photoUrl },
      })
      .where(eq(schema.products.id, id));
  } else {
    await db.insert(schema.products).values({
      orgId: org.id,
      name: name!,
      brandProfileId: brandProfileId ?? null,
      description,
      targetAudience,
      brand: { photoUrl },
    });
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}

export async function deleteProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "id");
  if (!id) return;

  await db
    .delete(schema.products)
    .where(and(eq(schema.products.id, id), eq(schema.products.orgId, org.id)));

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
}
