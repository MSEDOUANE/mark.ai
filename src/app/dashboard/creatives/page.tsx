import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, asc } from "drizzle-orm";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { CreativeCard } from "../campaigns/[id]/creative-card";
import { AssignForm } from "./assign-form";
import { CreativesToolbar } from "./creatives-toolbar";
import { RetrySelector } from "./retry-selector";
import { CreativesPoller } from "./creatives-poller";

const STATUS_LABEL: Record<string, string> = {
  pending:    "pending",
  generating: "generating",
  ready:      "ready",
  failed:     "failed",
};

type SearchParams = {
  generated?: string;
  error?: string;
  status?: string;
  sort?: string;
};

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const { generated, error, status: statusFilter, sort = "newest" } = await searchParams;

  // Build order
  const orderBy = sort === "score"
    ? desc(schema.creatives.createdAt)   // fallback — score is inside JSON; sort client-side
    : sort === "oldest"
    ? asc(schema.creatives.createdAt)
    : desc(schema.creatives.createdAt);

  const [allCreatives, campaigns] = await Promise.all([
    db
      .select({
        id:           schema.creatives.id,
        type:         schema.creatives.type,
        status:       schema.creatives.status,
        meta:         schema.creatives.meta,
        assetUrl:     schema.creatives.assetUrl,
        campaignId:   schema.creatives.campaignId,
        productName:  schema.products.name,
        campaignName: schema.campaigns.name,
        createdAt:    schema.creatives.createdAt,
      })
      .from(schema.creatives)
      .leftJoin(schema.products,  eq(schema.creatives.productId,  schema.products.id))
      .leftJoin(schema.campaigns, eq(schema.creatives.campaignId, schema.campaigns.id))
      .where(eq(schema.creatives.orgId, org.id))
      .orderBy(orderBy),

    db
      .select({ id: schema.campaigns.id, name: schema.campaigns.name })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.orgId, org.id))
      .orderBy(desc(schema.campaigns.createdAt)),
  ]);

  // Stats
  const generatingCount = allCreatives.filter(
    (c) => c.status === "pending" || c.status === "generating",
  ).length;
  const readyCount = allCreatives.filter((c) => c.status === "ready").length;

  // Filter
  let creatives = allCreatives;
  if (statusFilter === "generating") {
    creatives = allCreatives.filter(
      (c) => c.status === "pending" || c.status === "generating",
    );
  } else if (statusFilter === "ready") {
    creatives = allCreatives.filter((c) => c.status === "ready");
  }

  // Sort by score (meta.score — JSON field, must be done in JS)
  if (sort === "score") {
    creatives = [...creatives].sort((a, b) => {
      const sa = ((a.meta as Record<string, unknown>)?.score as number) ?? -1;
      const sb = ((b.meta as Record<string, unknown>)?.score as number) ?? -1;
      return sb - sa;
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <CreativesPoller generatingCount={generatingCount} />
      <div className="mx-auto max-w-7xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ad Creatives</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Generate conversion-focused creatives, scored and sized automatically.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/dashboard/creatives/new"
              className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              + New creative
            </Link>
          </div>
        </div>

        {/* Retry stuck creatives */}
        {generatingCount > 0 ? (
          <RetrySelector
            creatives={allCreatives
              .filter((c) => c.status === "pending" || c.status === "generating")
              .map((c) => ({
                id: c.id,
                headline: (c.meta as Record<string, unknown>)?.headline as string | undefined,
                productName: c.productName ?? undefined,
                status: c.status,
              }))}
          />
        ) : null}

        {/* Banners */}
        {generated ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-200">
            <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>{generated}</strong> creative{Number(generated) !== 1 ? "s" : ""} queued.
              AI is scoring and rendering backgrounds now — they&apos;ll appear below in seconds.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        {allCreatives.length > 0 ? (
          <Suspense fallback={null}>
            <CreativesToolbar
              total={allCreatives.length}
              generating={generatingCount}
              ready={readyCount}
            />
          </Suspense>
        ) : null}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {allCreatives.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/80">
              <svg className="h-9 w-9 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold">No creatives yet</h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Generate your first AI-scored ad creative. It takes under 30 seconds
              and produces 4 sizes automatically.
            </p>
            <Link href="/dashboard/creatives/new"
              className="mt-6 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              Generate your first creative →
            </Link>
          </div>
        ) : creatives.length === 0 ? (
          /* Filtered empty */
          <div className="mt-16 text-center">
            <p className="text-zinc-500">No creatives match this filter.</p>
            <Link href="/dashboard/creatives" className="mt-2 inline-block text-sm text-amber-400 hover:underline">
              Clear filter
            </Link>
          </div>
        ) : (
          /* ── Grid ──────────────────────────────────────────────────────── */
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {creatives.map((c) => {
              const meta = (c.meta ?? {}) as Record<string, unknown>;
              return (
                <div key={c.id} className="flex flex-col gap-2">
                  <CreativeCard
                    id={c.id}
                    type={c.type}
                    status={c.status}
                    template={meta.template as string | undefined}
                    headline={meta.headline as string | undefined}
                    primaryText={meta.primaryText as string | undefined}
                    score={meta.score as number | undefined}
                    scoreRationale={meta.scoreRationale as string | undefined}
                    scoreTips={meta.scoreTips as string[] | undefined}
                    statusLabel={STATUS_LABEL[c.status] ?? c.status}
                    assetVersion={c.assetUrl?.slice(0, 12) ?? null}
                  />

                  {/* Campaign assignment */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {c.productName ? (
                          <span className="text-zinc-400">{c.productName}</span>
                        ) : "Standalone"}
                      </span>
                      {c.campaignName ? (
                        <Link href={`/dashboard/campaigns/${c.campaignId}`}
                          className="flex items-center gap-1 text-amber-400 hover:underline">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          {c.campaignName}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">unassigned</span>
                      )}
                    </div>
                    {campaigns.length > 0 ? (
                      <AssignForm
                        creativeId={c.id}
                        currentCampaignId={c.campaignId}
                        campaigns={campaigns}
                      />
                    ) : null}
                    {!c.campaignId && (
                      <Link href={`/dashboard/creatives/${c.id}/publish`}
                        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-amber-400/10 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/20">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Publish as ad
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
