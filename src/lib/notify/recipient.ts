import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Where an org's notifications go: REPORT_EMAIL_TO override when set, else the
 * org owner's login email. Null when neither resolves (send is skipped).
 */
export async function orgNotifyEmail(orgId: string): Promise<string | null> {
  const override = (process.env.REPORT_EMAIL_TO ?? "").trim();
  if (override) return override;

  const [owner] = await db
    .select({ email: schema.profiles.email })
    .from(schema.memberships)
    .innerJoin(schema.profiles, eq(schema.memberships.userId, schema.profiles.id))
    .where(
      and(
        eq(schema.memberships.orgId, orgId),
        eq(schema.memberships.role, "owner"),
      ),
    )
    .limit(1);
  return owner?.email ?? null;
}
