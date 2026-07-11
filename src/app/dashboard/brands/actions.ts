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

export async function saveBrandProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const name = clean(formData, "name");
  if (!name) redirect("/dashboard/brands/new?error=" + encodeURIComponent("Brand name is required"));

  const id = clean(formData, "id"); // present when editing

  if (id) {
    // verify ownership
    const [existing] = await db.select({ id: schema.brandProfiles.id })
      .from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)))
      .limit(1);
    if (!existing) redirect("/dashboard/brands");

    await db.update(schema.brandProfiles).set({
      name:         name!,
      primaryColor: clean(formData, "primaryColor"),
      logoUrl:      clean(formData, "logoUrl"),
      websiteUrl:   clean(formData, "websiteUrl"),
      tone:         clean(formData, "tone"),
      description:  clean(formData, "description"),
      updatedAt:    new Date(),
    }).where(eq(schema.brandProfiles.id, id));
  } else {
    await db.insert(schema.brandProfiles).values({
      orgId:        org.id,
      name:         name!,
      primaryColor: clean(formData, "primaryColor"),
      logoUrl:      clean(formData, "logoUrl"),
      websiteUrl:   clean(formData, "websiteUrl"),
      tone:         clean(formData, "tone"),
      description:  clean(formData, "description"),
    });
  }

  revalidatePath("/dashboard/brands");
  redirect("/dashboard/brands");
}

export async function deleteBrandProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "id");
  if (!id) return;

  await db.delete(schema.brandProfiles).where(
    and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id))
  );

  revalidatePath("/dashboard/brands");
  redirect("/dashboard/brands");
}
