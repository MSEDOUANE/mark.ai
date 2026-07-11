"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

/** Dismiss an open anomaly alert — also re-arms detection for that type. */
export async function dismissAlert(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { org } = await ensureProfile(user);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await db
    .update(schema.alerts)
    .set({ status: "dismissed" })
    .where(and(eq(schema.alerts.id, id), eq(schema.alerts.orgId, org.id)));

  revalidatePath("/dashboard");
}
