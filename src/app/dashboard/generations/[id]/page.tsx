import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import {
  loadGenerationThread,
  loadNewerVersion,
  GENERATION_TOOL_LABELS,
} from "@/lib/ai/tool-context";
import { GenerationOutput } from "@/components/generation-output";
import { isRefinable } from "../dispatch";
import { ThreadRefineForm } from "./thread-refine-form";

function productNameOf(input: unknown): string | null {
  if (input && typeof input === "object") {
    const v = (input as Record<string, unknown>).productName;
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export default async function GenerationThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const { id } = await params;
  const { error } = await searchParams;

  const chain = await loadGenerationThread(id, org.id);
  if (chain.length === 0) notFound();

  const target = chain[chain.length - 1];
  const root = chain[0];
  const toolLabel = GENERATION_TOOL_LABELS[target.tool] ?? target.tool.replace(/-/g, " ");
  const title = productNameOf(root.input) ?? toolLabel;
  const refinable = isRefinable(target.tool);

  // The Library only links leaf (tip) generations, but a mid-chain version can
  // still be reached directly (a bookmarked/older URL). If this one was refined
  // further, don't claim it's the latest — point forward to the newer version.
  const newerVersionId = await loadNewerVersion(target.id, org.id);
  const isTip = newerVersionId === null;

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/library?kind=text"
            className="text-xs text-app-text-subtle hover:text-app-text"
          >
            ← Back to Library
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <span className="rounded-full bg-app-surface-2 px-2.5 py-1 text-xs text-app-text-muted">
              {toolLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-app-text-muted">
            {chain.length === 1
              ? "Original generation."
              : `${chain.length} versions in this refinement conversation.`}
          </p>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {!isTip && newerVersionId ? (
          <p className="mb-4 rounded-xl border border-app-border-strong bg-app-surface px-4 py-3 text-sm text-app-text-muted">
            This version was refined further.{" "}
            <Link
              href={`/dashboard/generations/${newerVersionId}`}
              className="font-medium text-amber-300 hover:text-amber-200"
            >
              Go to the newer version →
            </Link>
          </p>
        ) : null}

        {/* Version thread, oldest → newest */}
        <div className="space-y-4">
          {chain.map((row, i) => {
            const isLatest = i === chain.length - 1;
            return (
              <section
                key={row.id}
                className={`rounded-2xl border p-5 ${
                  isLatest
                    ? "border-amber-400/40 bg-app-surface"
                    : "border-app-border bg-app-surface/60"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-app-surface-2 text-xs font-bold text-app-text-muted">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-app-text">
                      {row.feedback ? "Refined" : "Original generation"}
                    </span>
                    {isLatest && isTip ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Latest
                      </span>
                    ) : null}
                  </div>
                  <time className="text-xs text-app-text-subtle">
                    {new Date(row.createdAt).toLocaleString()}
                  </time>
                </div>

                {row.feedback ? (
                  <p className="mb-3 rounded-lg border-l-2 border-amber-400/40 bg-app-bg/40 px-3 py-2 text-sm italic text-app-text-muted">
                    “{row.feedback}”
                  </p>
                ) : null}

                <GenerationOutput value={row.output} />
              </section>
            );
          })}
        </div>

        {/* Continue refining — only from the tip of the chain, so refinements
            extend one conversation instead of forking hidden branches. */}
        <div className="mt-5 rounded-2xl border border-app-border-strong bg-app-surface p-4">
          {!refinable ? (
            <p className="text-sm text-app-text-subtle">
              This content type doesn’t support refine yet.
            </p>
          ) : isTip ? (
            <ThreadRefineForm generationId={target.id} />
          ) : (
            <p className="text-sm text-app-text-subtle">
              Refine from the{" "}
              <Link
                href={`/dashboard/generations/${newerVersionId}`}
                className="font-medium text-amber-300 hover:text-amber-200"
              >
                newest version
              </Link>{" "}
              to keep the conversation in one line.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
