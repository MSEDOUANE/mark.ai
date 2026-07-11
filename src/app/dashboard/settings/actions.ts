"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { encryptSecret } from "@/lib/crypto";
import { resolveMetaToken } from "@/lib/ads/meta-token";

async function requireOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  return org;
}

export async function connectAdAccount(formData: FormData) {
  const org = await requireOrg();

  const platform = String(formData.get("platform") ?? "meta") as
    | "meta"
    | "tiktok";
  const externalId = String(formData.get("externalId") ?? "").trim();
  const token = String(formData.get("accessToken") ?? "").trim();
  if (!externalId || !token) {
    redirect(
      "/dashboard/settings?error=" +
        encodeURIComponent("Ad account id and access token are required"),
    );
  }

  // For Meta, try to upgrade a short-lived token to a long-lived one.
  let finalToken = token;
  const accountMeta: Record<string, unknown> = {};
  if (platform === "meta") {
    const r = await resolveMetaToken(token);
    finalToken = r.token;
    accountMeta.tokenExpiresAt = r.expiresAt;
    accountMeta.tokenExchanged = r.exchanged;
  }

  const encryptedToken = encryptSecret(finalToken);
  await db
    .insert(schema.adAccounts)
    .values({
      orgId: org.id,
      platform,
      externalId,
      encryptedToken,
      status: "connected",
      meta: accountMeta,
    })
    .onConflictDoUpdate({
      target: [
        schema.adAccounts.orgId,
        schema.adAccounts.platform,
        schema.adAccounts.externalId,
      ],
      set: { encryptedToken, status: "connected", meta: accountMeta },
    });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings");
}

export async function disconnectAdAccount(formData: FormData) {
  const org = await requireOrg();
  const id = String(formData.get("id") ?? "");
  await db
    .delete(schema.adAccounts)
    .where(and(eq(schema.adAccounts.id, id), eq(schema.adAccounts.orgId, org.id)));
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings");
}

const AUTONOMY_VALUES = ["approve_all", "approve_spend", "full_auto"] as const;

export async function updateAutonomy(formData: FormData) {
  const org = await requireOrg();
  const level = String(formData.get("autonomyLevel") ?? "");
  if (!AUTONOMY_VALUES.includes(level as (typeof AUTONOMY_VALUES)[number])) {
    redirect("/dashboard/settings");
  }
  await db
    .update(schema.organizations)
    .set({ autonomyLevel: level as (typeof AUTONOMY_VALUES)[number] })
    .where(eq(schema.organizations.id, org.id));
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings");
}
