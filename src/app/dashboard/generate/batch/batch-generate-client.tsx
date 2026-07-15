"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startBatchGeneration } from "./actions";

interface Product {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || count === 0}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-50">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Queuing…</>
      ) : (
        `Generate ${count || ""} creative${count !== 1 ? "s" : ""}`
      )}
    </button>
  );
}

export function BatchGenerateClient({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  return (
    <form action={startBatchGeneration} className="space-y-5">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="productIds" value={id} />
      ))}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="font-semibold">Shared brief</h3>
        <div>
          <label className="text-sm text-zinc-400">What should every ad say? *</label>
          <textarea name="brief" rows={3} required
            placeholder="Example: Highlight fast delivery and a limited-time 20% discount, warm and inviting tone"
            className={`mt-1.5 ${field}`} />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Goal <span className="text-zinc-600">(optional)</span></label>
          <input name="goal" placeholder="Drive first-time purchases" className={`mt-1.5 ${field}`} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Products ({selected.size}/{products.length})</h3>
          <button type="button" onClick={toggleAll} className="text-xs font-semibold text-amber-400 hover:underline">
            {selected.size === products.length ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {products.map((p) => {
            const on = selected.has(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  on ? "border-amber-400/50 bg-amber-950/25 ring-1 ring-amber-400" : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                }`}>
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${on ? "text-amber-200" : "text-zinc-200"}`}>{p.name}</p>
                  {p.description && <p className="truncate text-xs text-zinc-500">{p.description}</p>}
                </div>
                {on && (
                  <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <SubmitButton count={selected.size} />
    </form>
  );
}
