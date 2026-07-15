"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";

export async function startBatchGeneration(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const productIds = formData.getAll("productIds") as string[];
  const brief = String(formData.get("brief") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim() || null;

  if (productIds.length === 0) {
    redirect("/dashboard/generate/batch?error=" + encodeURIComponent("Select at least one product."));
  }
  if (!brief) {
    redirect("/dashboard/generate/batch?error=" + encodeURIComponent("Describe the shared campaign brief."));
  }

  // Verify every selected product belongs to this org before fanning out.
  const owned = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.orgId, org.id), inArray(schema.products.id, productIds)));
  const ownedIds = owned.map((p) => p.id);
  if (ownedIds.length === 0) {
    redirect("/dashboard/generate/batch?error=" + encodeURIComponent("No valid products selected."));
  }

  await inngest.send({
    name: "creative/batch.requested",
    data: { orgId: org.id, productIds: ownedIds, brief, goal },
  });

  redirect(`/dashboard/creatives?generated=${ownedIds.length}`);
}
