"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/dashboard");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const [invite] = await db
    .select()
    .from(schema.pendingInvites)
    .where(eq(schema.pendingInvites.token, token))
    .limit(1);

  if (!invite || invite.status !== "pending" || invite.expiresAt.getTime() < Date.now()) {
    redirect("/dashboard");
  }
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    redirect(`/invite/${token}`);
  }

  // Single-tenant bridge: ensures the user has a membership in "the org"
  // (there is only one). Then set that membership's role to what was invited.
  const { org } = await ensureProfile(user);

  if (org.id === invite.orgId) {
    await db
      .update(schema.memberships)
      .set({ role: invite.role })
      .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, org.id)));
  }

  await db
    .update(schema.pendingInvites)
    .set({ status: "accepted" })
    .where(eq(schema.pendingInvites.id, invite.id));

  redirect("/dashboard/settings?info=" + encodeURIComponent("Welcome to the team!"));
}
