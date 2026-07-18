import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { CalendarGenerator } from "./calendar-generator";

export default async function MarketingCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const brands = await db
    .select({
      id: schema.brandProfiles.id,
      name: schema.brandProfiles.name,
      tone: schema.brandProfiles.tone,
      description: schema.brandProfiles.description,
      primaryColor: schema.brandProfiles.primaryColor,
      logoUrl: schema.brandProfiles.logoUrl,
      voiceNotes: schema.brandProfiles.voiceNotes,
    })
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.orgId, org.id))
    .orderBy(desc(schema.brandProfiles.createdAt));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-app-text-muted hover:text-app-text">
            ← Generate
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl">🗓️</span>
            <div>
              <h1 className="text-2xl font-bold">Marketing Calendar</h1>
              <p className="mt-0.5 text-sm text-app-text-muted">
                A prioritized calendar of seasonal, religious, and retail moments to plan campaigns around.
              </p>
            </div>
          </div>
        </div>

        <CalendarGenerator brands={brands} />
      </div>
    </main>
  );
}
