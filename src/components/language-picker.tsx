"use client";

import { useState } from "react";
import { LANGUAGES, ARABIC_DIALECTS } from "@/lib/ai/languages";

const field =
  "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none focus:border-zinc-500";

/**
 * Language + Arabic-dialect picker for text-generation tools (ad copy,
 * captions, personas, landing pages, etc). Defaults to Arabic / Moroccan
 * Darija — the primary market. Render inside the tool's <form>: the hidden
 * `language`/`dialect` fields submit with the rest of the form.
 */
export function LanguagePicker({
  defaultLanguage = "ar",
  defaultDialect = "darija",
}: {
  defaultLanguage?: string;
  defaultDialect?: string;
}) {
  const [language, setLanguage] = useState(defaultLanguage);

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-3">
      <h3 className="font-semibold">Language</h3>
      <select
        name="language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className={field}
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>

      {/* Dialect — only meaningful for Arabic. Kept mounted (hidden) so its
          value still submits; defaults to Moroccan Darija. */}
      <label className={`block text-sm ${language === "ar" ? "" : "hidden"}`}>
        <span className="text-app-text-muted">
          Arabic dialect{" "}
          <span className="text-app-text-subtle">— written how this audience actually speaks</span>
        </span>
        <select name="dialect" className={`mt-1.5 ${field}`} defaultValue={defaultDialect}>
          {ARABIC_DIALECTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
