"use client";

import { useState } from "react";

const field =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-500";

/**
 * Language + voice picker for the studio. When Arabic is selected it reveals a
 * dialect selector — Moroccan Darija vs Gulf/Egyptian/etc. are not
 * interchangeable, and the wrong one loses the audience.
 */
export function VoicePicker({
  languages,
  dialects,
}: {
  languages: Array<{ id: string; label: string }>;
  dialects: Array<{ id: string; label: string }>;
}) {
  const [language, setLanguage] = useState("ar");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block">
          <span className="text-zinc-400">Voiceover language</span>
          <select
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`mt-1.5 ${field}`}
          >
            {languages.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-zinc-400">Voice</span>
          <select name="voice" className={`mt-1.5 ${field}`} defaultValue="female">
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>

      {/* Dialect — only meaningful for Arabic. Kept mounted (hidden) so its
          value still submits; defaults to Moroccan Darija. */}
      <label className={`block text-sm ${language === "ar" ? "" : "hidden"}`}>
        <span className="text-zinc-400">
          Arabic dialect{" "}
          <span className="text-zinc-600">— written how this audience actually speaks</span>
        </span>
        <select name="dialect" className={`mt-1.5 ${field}`} defaultValue={dialects[0]?.id}>
          {dialects.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
