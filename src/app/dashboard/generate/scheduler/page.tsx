import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { Scheduler, type QueueItem } from "./scheduler";

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{ info?: string; error?: string }>;
}) {
  const { info, error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [brands, posts, connected] = await Promise.all([
    db
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
      .orderBy(desc(schema.brandProfiles.createdAt)),
    db
      .select()
      .from(schema.scheduledPosts)
      .where(eq(schema.scheduledPosts.orgId, org.id))
      .orderBy(desc(schema.scheduledPosts.scheduledFor)),
    db
      .select({ id: schema.adAccounts.id })
      .from(schema.adAccounts)
      .where(and(eq(schema.adAccounts.orgId, org.id), eq(schema.adAccounts.status, "connected")))
      .limit(1),
  ]);

  const queue: QueueItem[] = posts.map((p) => ({
    id: p.id,
    caption: p.caption,
    imageUrl: p.imageUrl,
    status: p.status,
    scheduledFor: p.scheduledFor.toISOString(),
    permalink: p.permalink,
    error: p.error,
  }));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-app-text-muted hover:text-app-text">
            ← Generate
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl">📆</span>
            <div>
              <h1 className="text-2xl font-bold">Content Scheduler</h1>
              <p className="mt-0.5 text-sm text-app-text-muted">
                Plan a week of organic posts, then queue them to publish to your Meta Page automatically.
              </p>
            </div>
          </div>
        </div>

        <Scheduler
          brands={brands}
          queue={queue}
          hasConnection={connected.length > 0}
          info={info}
          error={error}
        />
      </div>
    </main>
  );
}
