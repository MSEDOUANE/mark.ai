import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db, schema } from "@/db";

/**
 * Bridges Supabase Auth (auth.users) to our app tables. On first authenticated
 * request we create a `profiles` row + `memberships` row linking the user to
 * the default organization. Single-tenant for now: everyone joins the one org.
 *
 * (Later, multi-tenant SaaS will create an org per signup instead.)
 */
export async function ensureProfile(user: User) {
  // Prefer the org the user actually belongs to — an unordered limit(1) over
  // organizations returns arbitrary heap order and broke after the hosted
  // migration left a stray empty org in the table.
  const [membership] = await db
    .select({ orgId: schema.memberships.orgId })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, user.id))
    .orderBy(schema.memberships.createdAt)
    .limit(1);

  let org: typeof schema.organizations.$inferSelect | undefined;
  if (membership) {
    [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, membership.orgId))
      .limit(1);
  }
  if (!org) {
    [org] = await db
      .select()
      .from(schema.organizations)
      .orderBy(schema.organizations.createdAt)
      .limit(1);
  }
  if (!org) {
    [org] = await db
      .insert(schema.organizations)
      .values({ name: "MarkAI" })
      .returning();
  }

  let [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);

  if (!profile) {
    [profile] = await db
      .insert(schema.profiles)
      .values({
        id: user.id,
        email: user.email ?? "",
        defaultOrgId: org.id,
      })
      .returning();
  }
  // Membership may be missing even when the profile exists (e.g. created by a
  // data migration) — ensure it either way.
  await db
    .insert(schema.memberships)
    .values({ userId: user.id, orgId: org.id, role: "owner" })
    .onConflictDoNothing();

  return { profile, org };
}
