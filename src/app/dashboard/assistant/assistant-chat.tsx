"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  get_overview: "Checked account overview",
  get_campaign_performance: "Read campaign performance",
  list_brands_and_products: "Looked up brands & products",
  create_campaign: "Created a campaign",
  refresh_campaign_creatives: "Generated fresh creatives",
  request_optimization: "Ran the optimizer",
  generate_weekly_report: "Queued a report",
  spy_competitor_ads: "Searched competitor ads",
  propose_budget_allocation: "Proposed budget reallocation",
};

const SUGGESTIONS = [
  "How are my campaigns doing?",
  "Any alerts or approvals waiting on me?",
  "Create a campaign for the Reveria Signature Collection to drive sales in MA and FR",
  "Generate this week's report",
];

/** Render **bold**, [links](…) and line breaks from the assistant's markdown-lite. */
function renderContent(text: string): React.ReactNode {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, pi) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={pi}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <a key={pi} href={link[2]} className="text-amber-400 underline hover:text-amber-300">
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </span>
  ));
}

export function AssistantChat({ initialHistory }: { initialHistory: ChatTurn[] }) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");
    const next = [...turns, { role: "user" as const, content: message }];
    setTurns(next);
    setPending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = (await res.json()) as {
        text?: string;
        toolsUsed?: string[];
        error?: string;
      };
      if (!res.ok || !json.text) throw new Error(json.error ?? "Assistant failed");
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: json.text!, toolsUsed: json.toolsUsed },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Thread */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-app-border bg-app-surface/40 p-4">
        {turns.length === 0 && !pending && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-3xl">✦</p>
            <p className="text-sm text-app-text-subtle">
              Ask anything about your marketing — I can read your real data and act on it.
            </p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-app-border-strong px-3.5 py-1.5 text-xs text-app-text transition-colors hover:border-amber-400/50 hover:text-amber-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-amber-400/15 px-4 py-2.5 text-sm text-amber-50">
                {t.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-2">
                {t.toolsUsed && t.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.toolsUsed.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full bg-app-surface-2 px-2.5 py-0.5 text-[10px] font-medium text-app-text-muted"
                      >
                        ⚙ {TOOL_LABELS[tool] ?? tool}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-bl-md border border-app-border bg-app-surface px-4 py-2.5 text-sm leading-relaxed text-app-text">
                  {renderContent(t.content)}
                </div>
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-app-border bg-app-surface px-4 py-3">
              <svg className="h-4 w-4 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-app-text-subtle">Working — checking data and running tools…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Composer */}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your marketing manager…"
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none transition-colors placeholder:text-app-text-subtle focus:border-zinc-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="shrink-0 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
