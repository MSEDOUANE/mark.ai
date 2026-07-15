"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCreativeTags } from "./actions";

export function TagEditor({ creativeId, tags }: { creativeId: string; tags: string[] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tags.join(", "));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const fd = new FormData();
    fd.append("creativeId", creativeId);
    fd.append("tags", value);
    startTransition(async () => {
      await updateCreativeTags(fd);
      router.refresh();
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          placeholder="tag1, tag2…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-400"
        />
        <button type="button" onClick={save} disabled={isPending}
          className="shrink-0 rounded-lg bg-amber-400 px-2 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-60">
          {isPending ? "…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{t}</span>
      ))}
      <button type="button" onClick={() => setEditing(true)}
        className="text-[10px] text-zinc-600 hover:text-zinc-400">
        {tags.length ? "edit tags" : "+ add tags"}
      </button>
    </div>
  );
}
