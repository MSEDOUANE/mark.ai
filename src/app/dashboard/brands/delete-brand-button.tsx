"use client";

import { useFormStatus } from "react-dom";
import { deleteBrandProfile } from "./actions";

function DeleteBtn({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      onClick={(e) => {
        if (!confirm(`Delete brand "${name}"? You can undo this right after.`)) e.preventDefault();
      }}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-border-strong text-app-text-subtle transition-colors hover:border-red-400/40 hover:text-red-400 disabled:opacity-50">
      {pending ? (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      )}
    </button>
  );
}

export function DeleteBrandButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteBrandProfile}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <DeleteBtn name={name} />
    </form>
  );
}
