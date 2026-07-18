import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { BrandForm } from "../../brand-form";
import { restoreBrandProfileVersion, type BrandProfileSnapshot } from "../../actions";

export default async function EditBrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; restored?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const { id } = await params;
  const { error, restored } = await searchParams;

  const [brand] = await db
    .select()
    .from(schema.brandProfiles)
    .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)))
    .limit(1);

  if (!brand) notFound();

  const history = await db
    .select({
      id: schema.brandProfileHistory.id,
      snapshot: schema.brandProfileHistory.snapshot,
      createdAt: schema.brandProfileHistory.createdAt,
    })
    .from(schema.brandProfileHistory)
    .where(eq(schema.brandProfileHistory.brandProfileId, id))
    .orderBy(desc(schema.brandProfileHistory.createdAt))
    .limit(20);

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard/brands" className="text-sm text-app-text-muted hover:text-app-text">
            ← Brands
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Edit brand — {brand.name}</h1>
        </div>

        {restored ? (
          <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            Restored an earlier version. The version you just left is saved too — restore it back if needed.
          </div>
        ) : null}

        <BrandForm brand={brand} error={error} />

        {history.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-app-border bg-app-surface/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-app-text-subtle">Version history</h2>
            <p className="mt-1 text-xs text-app-text-subtle">
              A snapshot is saved every time you save changes. Restoring saves the current version too, so you can always undo a restore.
            </p>
            <div className="mt-4 space-y-2">
              {history.map((h) => {
                const snap = h.snapshot as BrandProfileSnapshot;
                return (
                  <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-app-text">{snap.name}</p>
                      <p className="mt-0.5 text-xs text-app-text-subtle">
                        {new Date(h.createdAt).toLocaleString()}
                        {snap.tone ? ` · ${snap.tone}` : ""}
                      </p>
                    </div>
                    <form action={restoreBrandProfileVersion}>
                      <input type="hidden" name="brandId" value={id} />
                      <input type="hidden" name="historyId" value={h.id} />
                      <button type="submit" className="shrink-0 rounded-lg border border-app-border-strong px-3 py-1.5 text-xs font-medium text-app-text hover:border-zinc-500">
                        Restore
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
