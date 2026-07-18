"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

async function currentOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  return org;
}

/** Flip an item's favorite flag. Upserts the meta row if it doesn't exist yet. */
export async function toggleFavorite(formData: FormData) {
  const org = await currentOrg();
  const kind = String(formData.get("kind") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!kind || !itemId) return;

  await db
    .insert(schema.libraryItemMeta)
    .values({ orgId: org.id, kind, itemId, favorite: next })
    .onConflictDoUpdate({
      target: [schema.libraryItemMeta.orgId, schema.libraryItemMeta.kind, schema.libraryItemMeta.itemId],
      set: { favorite: next, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/library");
}

/** Set (or clear, via empty string) an item's folder. */
export async function setFolder(formData: FormData) {
  const org = await currentOrg();
  const kind = String(formData.get("kind") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const folder = String(formData.get("folder") ?? "").trim() || null;
  if (!kind || !itemId) return;

  await db
    .insert(schema.libraryItemMeta)
    .values({ orgId: org.id, kind, itemId, folder })
    .onConflictDoUpdate({
      target: [schema.libraryItemMeta.orgId, schema.libraryItemMeta.kind, schema.libraryItemMeta.itemId],
      set: { folder, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/library");
}
