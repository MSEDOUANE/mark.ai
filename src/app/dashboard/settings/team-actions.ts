"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { emailEnabled, sendEmail } from "@/lib/notify/email";

async function requireManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org, profile } = await ensureProfile(user);

  const [membership] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.orgId, org.id)))
    .limit(1);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect("/dashboard/settings?error=" + encodeURIComponent("Only owners and admins can manage the team."));
  }
  return { org, profile };
}

export async function inviteMember(formData: FormData) {
  const { org, profile } = await requireManager();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  if (!email || !email.includes("@")) {
    redirect("/dashboard/settings?error=" + encodeURIComponent("Enter a valid email."));
  }
  if (!["owner", "admin", "member"].includes(role)) {
    redirect("/dashboard/settings?error=" + encodeURIComponent("Invalid role."));
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await db.insert(schema.pendingInvites).values({
    orgId: org.id,
    email,
    role: role as "owner" | "admin" | "member",
    invitedBy: profile.id,
    token,
    expiresAt,
  });

  if (emailEnabled()) {
    const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    await sendEmail({
      to: email,
      subject: "You're invited to join MarkAI",
      html: `<p>You've been invited to join a MarkAI workspace as <strong>${role}</strong>.</p>` +
        `<p><a href="${appUrl}/invite/${token}">Accept invite →</a></p>` +
        `<p style="color:#888;font-size:12px">This link expires in 14 days.</p>`,
    });
  }

  revalidatePath("/dashboard/settings");
}

export async function cancelInvite(formData: FormData) {
  const { org } = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(schema.pendingInvites)
    .set({ status: "revoked" })
    .where(and(eq(schema.pendingInvites.id, id), eq(schema.pendingInvites.orgId, org.id)));

  revalidatePath("/dashboard/settings");
}

export async function changeMemberRole(formData: FormData) {
  const { org } = await requireManager();
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!membershipId || !["owner", "admin", "member"].includes(role)) return;

  // Guard: don't leave the org without at least one owner.
  if (role !== "owner") {
    const owners = await db
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.role, "owner")));
    if (owners.length === 1 && owners[0].id === membershipId) {
      redirect("/dashboard/settings?error=" + encodeURIComponent("The org must keep at least one owner."));
    }
  }

  await db
    .update(schema.memberships)
    .set({ role: role as "owner" | "admin" | "member" })
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.orgId, org.id)));

  revalidatePath("/dashboard/settings");
}

export async function removeMember(formData: FormData) {
  const { org } = await requireManager();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return;

  const [target] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.id, membershipId), eq(schema.memberships.orgId, org.id)))
    .limit(1);
  if (!target) return;

  if (target.role === "owner") {
    const owners = await db
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.role, "owner")));
    if (owners.length <= 1) {
      redirect("/dashboard/settings?error=" + encodeURIComponent("The org must keep at least one owner."));
    }
  }

  await db.delete(schema.memberships).where(eq(schema.memberships.id, membershipId));
  revalidatePath("/dashboard/settings");
}
