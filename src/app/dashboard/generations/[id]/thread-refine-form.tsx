"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { refineGeneration } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="whitespace-nowrap rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Refining…" : "Refine with feedback"}
    </button>
  );
}

/**
 * Feedback box on the generation thread page. Unlike the live-tool RefinePanel
 * (which updates in place via useActionState), this posts to the
 * `refineGeneration` server action, which persists a new version and redirects
 * to its thread — so the whole conversation stays server-rendered and
 * refresh-proof.
 */
export function ThreadRefineForm({ generationId }: { generationId: string }) {
  const [feedback, setFeedback] = useState("");

  return (
    <form
      action={refineGeneration}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="generationId" value={generationId} />
      <label className="flex-1 text-sm">
        <span className="mb-1 block text-xs text-app-text-muted">
          Continue refining — say what to change and generate the next version.
        </span>
        <textarea
          name="refineFeedback"
          required
          rows={2}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Make the hook punchier, mention free shipping, sound less formal…"
          className="w-full resize-none rounded-xl border border-app-border-strong bg-app-bg px-3 py-2 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500"
        />
      </label>
      <SubmitButton />
    </form>
  );
}
