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

/** The editable fields captured in each brand_profile_history snapshot. */
export interface BrandProfileSnapshot {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  tone: string | null;
  description: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  defaultTemplate: string | null;
  voiceNotes: string | null;
  assets: BrandAsset[];
}

type BrandRow = typeof schema.brandProfiles.$inferSelect;

function toSnapshot(row: BrandRow): BrandProfileSnapshot {
  return {
    name: row.name,
    primaryColor: row.primaryColor,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    tone: row.tone,
    description: row.description,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    fontFamily: row.fontFamily,
    defaultTemplate: row.defaultTemplate,
    voiceNotes: row.voiceNotes,
    assets: (row.assets ?? []) as BrandAsset[],
  };
}

/** Records the brand's current field values before an update overwrites them. */
async function recordHistory(orgId: string, brandProfileId: string, row: BrandRow) {
  await db.insert(schema.brandProfileHistory).values({
    orgId,
    brandProfileId,
    snapshot: toSnapshot(row),
  });
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
    // verify ownership; fetch the FULL row so we can snapshot it before overwriting.
    const [existing] = await db.select()
      .from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)))
      .limit(1);
    if (!existing) redirect("/dashboard/brands");

    await recordHistory(org.id, id, existing);

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

/**
 * Restores a brand to a prior snapshot. Snapshots the CURRENT state first
 * (same recordHistory() used by every edit), so restoring is itself
 * reversible — the version you just left is always one click away too.
 */
export async function restoreBrandProfileVersion(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const brandId = clean(formData, "brandId");
  const historyId = clean(formData, "historyId");
  if (!brandId || !historyId) return;

  const [current] = await db.select()
    .from(schema.brandProfiles)
    .where(and(eq(schema.brandProfiles.id, brandId), eq(schema.brandProfiles.orgId, org.id)))
    .limit(1);
  if (!current) redirect("/dashboard/brands");

  const [version] = await db.select({ snapshot: schema.brandProfileHistory.snapshot })
    .from(schema.brandProfileHistory)
    .where(
      and(
        eq(schema.brandProfileHistory.id, historyId),
        eq(schema.brandProfileHistory.brandProfileId, brandId),
        eq(schema.brandProfileHistory.orgId, org.id),
      ),
    )
    .limit(1);
  if (!version) redirect(`/dashboard/brands/${brandId}/edit`);

  await recordHistory(org.id, brandId, current);

  const snap = version.snapshot as BrandProfileSnapshot;
  await db.update(schema.brandProfiles).set({
    name: snap.name,
    primaryColor: snap.primaryColor,
    logoUrl: snap.logoUrl,
    websiteUrl: snap.websiteUrl,
    tone: snap.tone,
    description: snap.description,
    secondaryColor: snap.secondaryColor,
    accentColor: snap.accentColor,
    fontFamily: snap.fontFamily,
    defaultTemplate: snap.defaultTemplate,
    voiceNotes: snap.voiceNotes,
    assets: snap.assets,
    updatedAt: new Date(),
  }).where(eq(schema.brandProfiles.id, brandId));

  revalidatePath(`/dashboard/brands/${brandId}/edit`);
  revalidatePath("/dashboard/brands");
  redirect(`/dashboard/brands/${brandId}/edit?restored=1`);
}
