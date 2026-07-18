"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite, setFolder } from "./actions";

export function FavoriteButton({
  kind,
  itemId,
  favorite,
}: {
  kind: string;
  itemId: string;
  favorite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("itemId", itemId);
    fd.append("next", String(!favorite));
    startTransition(async () => {
      await toggleFavorite(fd);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
        favorite ? "bg-amber-400 text-zinc-950" : "bg-black/50 text-white hover:bg-black/70"
      }`}
    >
      <svg className="h-3.5 w-3.5" fill={favorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </button>
  );
}

export function FolderPicker({
  kind,
  itemId,
  folder,
  knownFolders,
}: {
  kind: string;
  itemId: string;
  folder: string | null;
  knownFolders: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(folder ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("itemId", itemId);
    fd.append("folder", value);
    startTransition(async () => {
      await setFolder(fd);
      router.refresh();
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <input
          autoFocus
          list={`folders-${kind}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          placeholder="Folder name…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-amber-400"
        />
        <datalist id={`folders-${kind}`}>
          {knownFolders.map((f) => <option key={f} value={f} />)}
        </datalist>
        <button type="button" onClick={save} disabled={isPending}
          className="shrink-0 rounded-lg bg-amber-400 px-2 py-1 text-[10px] font-semibold text-zinc-950 disabled:opacity-60">
          {isPending ? "…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
      className="mt-1.5 block truncate text-left text-[10px] text-zinc-600 hover:text-zinc-400"
    >
      {folder ? `📁 ${folder}` : "+ add to folder"}
    </button>
  );
}
