"use client";

import { useEffect, useRef, useState } from "react";

export interface RefineRound {
  round: number;
  feedback: string | null; // null for the original (round 1) generation
}

/**
 * Tracks refinement rounds client-side as a tool's useActionState `state`
 * moves through successive successful generations. Each tool's success
 * variant needs only a `generationId` field for this to work — the round's
 * feedback text is captured synchronously at submit time (via
 * `recordFeedback`, wired to `RefinePanel`'s `onSubmitFeedback`) since the
 * server state itself doesn't echo the feedback back.
 */
export function useRefinementRounds(state: {
  status: string;
  generationId?: string;
}): { rounds: RefineRound[]; recordFeedback: (feedback: string) => void } {
  const [rounds, setRounds] = useState<RefineRound[]>([]);
  const pendingFeedback = useRef<string | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "error") {
      // A failed refine must not leak its feedback onto the next success —
      // e.g. a fresh generation after the error would otherwise be logged
      // as a refine round it never was.
      pendingFeedback.current = null;
      return;
    }
    if (state.status !== "success" || !state.generationId) return;
    if (state.generationId === lastId.current) return;
    lastId.current = state.generationId;
    const feedback = pendingFeedback.current;
    pendingFeedback.current = null;
    // No feedback ⇒ this success came from the main form: a NEW original
    // generation (a fresh parentless chain server-side), so the round log
    // starts over instead of appending to the previous thread's history.
    setRounds((prev) =>
      feedback === null
        ? [{ round: 1, feedback: null }]
        : [...prev, { round: prev.length + 1, feedback }],
    );
  }, [state]);

  return {
    rounds,
    recordFeedback: (feedback: string) => {
      pendingFeedback.current = feedback;
    },
  };
}

/**
 * Feedback box + round log for "keep refining this result" — drop into any
 * Generate-hub tool's result view once it has a `state.success.generationId`.
 * Submits through the SAME useActionState formAction as the original
 * generate form (so the result area updates in place); the server action
 * reads `refineGenerationId`/`refineFeedback` off the form (see
 * `loadRefineParent`/`readRefineFeedback` in tool-context.ts) and falls back
 * to the parent generation's stored input for any field this form doesn't
 * resubmit — so only these two fields are ever needed here.
 */
export function RefinePanel({
  generationId,
  formAction,
  pending,
  history,
  onSubmitFeedback,
}: {
  generationId: string;
  formAction: (formData: FormData) => void;
  pending?: boolean;
  history: RefineRound[];
  onSubmitFeedback: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-app-border-strong bg-app-surface p-4">
      {history.length > 1 ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium text-app-text-muted hover:text-app-text"
          >
            {open ? "Hide" : "Show"} refinement history ({history.length} round
            {history.length === 1 ? "" : "s"}) {open ? "▲" : "▼"}
          </button>
          {open ? (
            <ol className="mt-2 space-y-1.5 border-l border-app-border-strong pl-3 text-xs text-app-text-muted">
              {history.map((r) => (
                <li key={r.round}>
                  <span className="text-app-text-subtle">Round {r.round}:</span>{" "}
                  {r.feedback ? `"${r.feedback}"` : "original generation"}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <form
        action={formAction}
        onSubmit={() => {
          onSubmitFeedback(feedback.trim());
          setFeedback("");
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="refineGenerationId" value={generationId} />
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs text-app-text-muted">
            Not quite right? Say what to change and regenerate.
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
        <button
          type="submit"
          disabled={pending || !feedback.trim()}
          className="whitespace-nowrap rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Refining…" : "Refine with feedback"}
        </button>
      </form>

      {/* Bridge to the durable, refresh-proof thread view of this content. */}
      {generationId ? (
        <a
          href={`/dashboard/generations/${generationId}`}
          className="mt-2 inline-block text-xs text-app-text-subtle hover:text-app-text"
        >
          Open full history →
        </a>
      ) : null}
    </div>
  );
}
