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
  let [org] = await db.select().from(schema.organizations).limit(1);
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

    await db
      .insert(schema.memberships)
      .values({ userId: user.id, orgId: org.id, role: "owner" })
      .onConflictDoNothing();
  }

  return { profile, org };
}
