/**
 * Generic, tool-agnostic renderer for a stored generation's `output` JSON.
 * Every Generate-hub tool's output is the same broad shape — some intro
 * strings, one or more arrays of item objects, and a few string[] tip lists —
 * so one recursive renderer covers all 11 tools (and any future tool) without
 * duplicating each tool's bespoke result cards. Used by the generation thread
 * page to show past content read-only, alongside a refine box.
 *
 * Pure server component (no hooks/state) — safe to render on the server.
 */

/** camelCase / snake_case / kebab-case field key → "Title Case" label. */
function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A scalar rendered inline (string/number/boolean). */
function Scalar({ value }: { value: string | number | boolean }) {
  const text = String(value);
  const multiline = text.includes("\n") || text.length > 140;
  return (
    <p
      className={`text-sm text-app-text ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}
    >
      {text}
    </p>
  );
}

/** string[] / number[] → chip row. */
function ChipList({ items }: { items: Array<string | number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="rounded-full bg-app-surface-2 px-2.5 py-0.5 text-xs text-app-text-muted"
        >
          {String(item)}
        </span>
      ))}
    </div>
  );
}

/** One labeled field within an object. */
function Field({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-app-text-subtle">
        {label}
      </p>
      <GenerationValue value={value} depth={depth + 1} />
    </div>
  );
}

/** Recursive value renderer. */
function GenerationValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <Scalar value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const allScalar = value.every(
      (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
    );
    if (allScalar) return <ChipList items={value as Array<string | number>} />;

    // Array of objects → a stack of cards.
    return (
      <div className="space-y-3">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border border-app-border-strong bg-app-bg/40 p-4"
          >
            <GenerationValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    // Guard against pathological nesting.
    if (depth > 6) {
      return (
        <pre className="overflow-x-auto rounded-lg bg-app-bg/60 p-2 text-xs text-app-text-muted">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    const entries = Object.entries(value);
    return (
      <div className="space-y-3">
        {entries.map(([k, v]) => (
          <Field key={k} label={humanize(k)} value={v} depth={depth} />
        ))}
      </div>
    );
  }

  return null;
}

/**
 * Top-level entry. Accepts the raw `output` from a generation row. Defends
 * against legacy double-encoded jsonb rows (a jsonb column holding an escaped
 * JSON *string* instead of an object — a known quirk on rows created before
 * 2026-07-13): if we get a string that parses to an object/array, render that.
 */
export function GenerationOutput({ value }: { value: unknown }) {
  let root = value;
  if (typeof root === "string") {
    try {
      const parsed = JSON.parse(root);
      if (isPlainObject(parsed) || Array.isArray(parsed)) root = parsed;
    } catch {
      /* leave as a plain string */
    }
  }

  if (root === null || root === undefined) {
    return <p className="text-sm text-app-text-subtle">No content.</p>;
  }

  return <GenerationValue value={root} depth={0} />;
}
