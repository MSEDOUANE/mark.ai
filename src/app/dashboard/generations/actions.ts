"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { DISPATCH } from "./dispatch";

const back = (id: string, error: string) =>
  `/dashboard/generations/${id}?error=${encodeURIComponent(error)}`;

/**
 * Continue-refining a previously-generated piece of content from the thread
 * page. Looks up the parent generation (org-scoped) to learn its tool, then
 * dispatches to that tool's own action with a refine-round FormData, and
 * redirects to the newly-created version's thread on success.
 */
export async function refineGeneration(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const parentId = String(formData.get("generationId") ?? "").trim();
  const feedback = String(formData.get("refineFeedback") ?? "").trim();
  if (!parentId) redirect("/dashboard/library");
  if (!feedback) redirect(back(parentId, "Add some feedback to refine."));

  const [parent] = await db
    .select({ tool: schema.generations.tool })
    .from(schema.generations)
    .where(
      and(eq(schema.generations.id, parentId), eq(schema.generations.orgId, org.id)),
    )
    .limit(1);
  if (!parent) redirect("/dashboard/library");

  const run = DISPATCH[parent.tool];
  if (!run) redirect(back(parentId, "This content type can't be refined."));

  const inner = new FormData();
  inner.set("refineGenerationId", parentId);
  inner.set("refineFeedback", feedback);

  const result = await run(inner);

  if (result.status === "success" && result.generationId) {
    redirect(`/dashboard/generations/${result.generationId}`);
  }
  redirect(back(parentId, result.message ?? "Refine failed. Try again."));
}
