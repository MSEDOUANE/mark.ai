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

export interface BrandAsset {
  url: string;
  label: string;
}

function cleanAssets(fd: FormData): BrandAsset[] {
  const raw = String(fd.get("assets") ?? "[]");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is BrandAsset => !!a && typeof a === "object" && typeof (a as BrandAsset).url === "string")
      .slice(0, 20)
      .map((a) => ({ url: a.url, label: String(a.label ?? "").slice(0, 60) }));
  } catch {
    return [];
  }
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
      name:            name!,
      primaryColor:    clean(formData, "primaryColor"),
      logoUrl:         clean(formData, "logoUrl"),
      websiteUrl:      clean(formData, "websiteUrl"),
      tone:            clean(formData, "tone"),
      description:     clean(formData, "description"),
      secondaryColor:  clean(formData, "secondaryColor"),
      accentColor:     clean(formData, "accentColor"),
      fontFamily:      clean(formData, "fontFamily"),
      defaultTemplate: clean(formData, "defaultTemplate"),
      voiceNotes:      clean(formData, "voiceNotes"),
      assets:          cleanAssets(formData),
      updatedAt:       new Date(),
    }).where(eq(schema.brandProfiles.id, id));
  } else {
    await db.insert(schema.brandProfiles).values({
      orgId:           org.id,
      name:            name!,
      primaryColor:    clean(formData, "primaryColor"),
      logoUrl:         clean(formData, "logoUrl"),
      websiteUrl:      clean(formData, "websiteUrl"),
      tone:            clean(formData, "tone"),
      description:     clean(formData, "description"),
      secondaryColor:  clean(formData, "secondaryColor"),
      accentColor:     clean(formData, "accentColor"),
      fontFamily:      clean(formData, "fontFamily"),
      defaultTemplate: clean(formData, "defaultTemplate"),
      voiceNotes:      clean(formData, "voiceNotes"),
      assets:          cleanAssets(formData),
    });
  }

  revalidatePath("/dashboard/brands");
  redirect("/dashboard/brands");
}

/**
 * Soft-deletes a brand (sets deletedAt instead of removing the row) so the
 * list page can offer an "Undo" affordance right after deleting. Restorable
 * indefinitely via restoreBrandProfile — no purge job runs against
 * soft-deleted rows, so nothing is ever silently lost.
 */
export async function deleteBrandProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "id");
  const name = clean(formData, "name") ?? "Brand";
  if (!id) return;

  await db
    .update(schema.brandProfiles)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)));

  revalidatePath("/dashboard/brands");
  redirect(
    `/dashboard/brands?undoId=${encodeURIComponent(id)}&undoName=${encodeURIComponent(name)}`,
  );
}

export async function restoreBrandProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "id");
  if (!id) return;

  await db
    .update(schema.brandProfiles)
    .set({ deletedAt: null })
    .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)));

  revalidatePath("/dashboard/brands");
  redirect("/dashboard/brands");
}
