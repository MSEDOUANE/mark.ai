import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { importMetaCampaigns } from "./actions";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; error?: string }>;
}) {
  const { imported, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const [campaigns, metaAccounts] = await Promise.all([
    db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id))
      .orderBy(desc(schema.campaigns.createdAt)),
    db
      .select()
      .from(schema.adAccounts)
      .where(
        and(
          eq(schema.adAccounts.orgId, org.id),
          eq(schema.adAccounts.platform, "meta"),
        ),
      ),
  ]);
  const metaAccount = metaAccounts[0];

  return (
    <main className="min-h-screen px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">
                ← Dashboard
              </Link>
              <h1 className="mt-1 text-xl font-semibold">Campaigns</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {metaAccount ? (
                <form action={importMetaCampaigns}>
                  <input type="hidden" name="adAccountId" value={metaAccount.id} />
                  <button className="rounded-full border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 hover:border-white/20">
                    Import from Meta
                  </button>
                </form>
              ) : null}
              <Link
                href="/dashboard/campaigns/new"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
              >
                New campaign
              </Link>
            </div>
          </div>
        </div>

        {imported ? (
          <p className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-950/45 p-4 text-sm text-emerald-100">
            Imported {imported} campaign(s) from Meta — open one and click “Get AI
            recommendation”.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/25 bg-red-950/45 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {campaigns.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-zinc-900/80 p-4 text-sm leading-7 text-zinc-200">
              No campaigns yet. Create a brief, or{" "}
              {metaAccount ? "import your existing ones from Meta" : "connect an ad account"}.
            </p>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/dashboard/campaigns/${c.id}`}
                  className="group min-w-0 flex-1 rounded-md"
                >
                  <div className="truncate font-medium text-zinc-50 group-hover:text-white">
                    {c.name}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-300">
                    {c.platform} · {c.status}
                    {c.budgetMinor != null
                      ? ` · ${(c.budgetMinor / 100).toFixed(2)} ${c.currency}/day`
                      : ""}
                  </div>
                </Link>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Link
                    href={`/dashboard/campaigns/${c.id}/chat`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-full border border-amber-300/25 bg-amber-300 px-3 py-2 text-center text-xs font-semibold text-zinc-950 hover:bg-amber-200 sm:flex-none"
                  >
                    AI Chat
                  </Link>
                  <Link
                    href={`/dashboard/campaigns/${c.id}`}
                    className="rounded-full border border-white/10 bg-zinc-950 px-3 py-2 text-center text-zinc-300 hover:border-white/20 hover:bg-zinc-800 hover:text-zinc-50"
                    aria-label={`Open ${c.name}`}
                  >
                    →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
