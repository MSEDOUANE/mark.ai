"use client";

import { useActionState } from "react";
import { postOrganic, type OrganicPostState } from "./organic-actions";

interface AdAccountOption {
  id: string;
  label: string;
}

const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

export function OrganicPostForm({
  creativeId,
  accounts,
  defaultCaption,
}: {
  creativeId: string;
  accounts: AdAccountOption[];
  defaultCaption: string;
}) {
  const [state, action, pending] = useActionState<OrganicPostState, FormData>(postOrganic, { status: "idle" });

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Post organically to your Page</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Publishes immediately to your connected Facebook Page&rsquo;s feed — no budget, no approval, no undo.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="creativeId" value={creativeId} />

        <div>
          <label className="text-sm text-zinc-400">Page (via ad account) *</label>
          <select name="adAccountId" className={`mt-1.5 ${field}`} defaultValue={accounts[0]?.id}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-zinc-400">Caption</label>
          <textarea name="caption" rows={3} defaultValue={defaultCaption} className={`mt-1.5 ${field}`} />
        </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{state.message}</p>
        )}
        {state.status === "success" && (
          <p className="rounded-xl border border-emerald-400/20 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-200">
            Posted! {state.permalink && <a href={state.permalink} target="_blank" rel="noreferrer" className="underline">View on Facebook →</a>}
          </p>
        )}

        <button type="submit" disabled={pending}
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 px-6 py-3 text-sm font-bold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-60">
          {pending ? "Posting…" : "Post now"}
        </button>
      </form>
    </div>
  );
}
