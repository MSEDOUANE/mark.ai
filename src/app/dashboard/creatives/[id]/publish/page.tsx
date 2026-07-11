import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { publishCreativeAsAd } from "./actions";

const field =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

export default async function PublishCreativePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { id } = await params;
  const { error } = await searchParams;

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, id), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) redirect("/dashboard/creatives");

  const adAccounts = await db
    .select()
    .from(schema.adAccounts)
    .where(eq(schema.adAccounts.orgId, org.id));
  const connected = adAccounts.filter((a) => a.encryptedToken);

  const meta = (creative.meta ?? {}) as Record<string, unknown>;
  const headline = (meta.headline as string | undefined) ?? "Untitled creative";

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/creatives" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Creatives
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Publish as ad</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ships this creative to Meta as a complete, <span className="text-zinc-200">paused</span> ad
          — campaign, ad set, and ad — after your approval. Nothing spends until
          you enable it in Meta.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
          {/* Creative preview */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/creatives/${creative.id}?size=portrait`}
              alt={headline}
              className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
            />
            <p className="mt-2 text-sm font-medium text-zinc-300">{headline}</p>
            {typeof meta.score === "number" ? (
              <p className="mt-0.5 text-xs text-zinc-500">Conversion score: {String(meta.score)}</p>
            ) : null}
          </div>

          {/* Publish form */}
          {connected.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">No ad account connected</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Connect your Meta ad account first, then come back to publish.
              </p>
              <Link href="/dashboard/settings"
                className="mt-4 inline-block rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
                Open settings →
              </Link>
            </div>
          ) : (
            <form action={publishCreativeAsAd} className="space-y-4">
              <input type="hidden" name="creativeId" value={creative.id} />

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                <div>
                  <label className="text-sm text-zinc-400">Ad account *</label>
                  <select name="adAccountId" className={`mt-1.5 ${field}`} defaultValue={connected[0].id}>
                    {connected.map((a) => {
                      const m = (a.meta ?? {}) as { name?: string; currency?: string };
                      return (
                        <option key={a.id} value={a.id}>
                          {m.name ?? a.externalId} {m.currency ? `(${m.currency})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-zinc-400">Destination URL *</label>
                  <input name="websiteUrl" type="url" required
                    placeholder="https://yourstore.com/product" className={`mt-1.5 ${field}`} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-zinc-400">Daily budget</label>
                    <input name="dailyBudget" type="number" min="1" step="0.01"
                      placeholder="10" className={`mt-1.5 ${field}`} />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Target countries</label>
                    <input name="geoCountries" placeholder="US, MA, FR" defaultValue="US"
                      className={`mt-1.5 ${field}`} />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400">Objective</label>
                  <select name="objective" className={`mt-1.5 ${field}`} defaultValue="traffic">
                    <option value="traffic">Traffic — clicks to your site</option>
                    <option value="sales">Sales — conversions</option>
                    <option value="leads">Leads — sign-ups & contacts</option>
                    <option value="awareness">Awareness — reach</option>
                  </select>
                </div>
              </div>

              {error ? (
                <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-300 hover:to-orange-300">
                Prepare launch → approval
              </button>
              <p className="text-center text-xs text-zinc-600">
                Creates the launch request — you review and approve it on the campaign page before anything reaches Meta.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
