/**
 * One-time mechanical migration: replace the chrome-purpose zinc utility
 * classes with the new theme-flippable app-* tokens across the dashboard
 * shell. Deliberately EXCLUDES text-zinc-950 (dark text on amber CTA
 * buttons — must stay fixed-dark regardless of theme) and text-white (same
 * fixed-contrast risk on colored badges) — see globals.css comment.
 *
 * Safety: every pattern is \b-anchored with a trailing (?!\d) so "zinc-50"
 * can never partially match inside "zinc-500" or "zinc-950" (a real risk —
 * "50" is a literal prefix of both). Opacity suffixes (/60, /90, ...) are
 * preserved automatically since they're appended after the matched shade
 * number, outside the replaced substring.
 *
 * Run: node scripts/migrate-theme-tokens.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const ROOTS = ["src/app/dashboard", "src/components"];
const DRY_RUN = process.argv.includes("--dry-run");

// [prefix, shade, newToken] — order doesn't matter between rows since each
// targets a distinct, non-overlapping (prefix, shade) pair.
const RULES = [
  ["bg", "950", "app-bg"],
  ["bg", "900", "app-surface"],
  ["bg", "800", "app-surface-2"],
  ["bg", "700", "app-surface-2"],
  ["border", "800", "app-border"],
  ["border", "700", "app-border-strong"],
  ["border", "600", "app-border-emphasis"],
  ["text", "50", "app-text"],
  ["text", "100", "app-text"],
  ["text", "200", "app-text"],
  ["text", "300", "app-text"],
  ["text", "400", "app-text-muted"],
  ["text", "500", "app-text-subtle"],
  ["text", "600", "app-text-subtle"],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

let filesChanged = 0;
const counts = Object.fromEntries(RULES.map((r) => [`${r[0]}-zinc-${r[1]}`, 0]));

for (const root of ROOTS) {
  for (const file of walk(root)) {
    let content = readFileSync(file, "utf8");
    let fileChanged = false;

    for (const [prefix, shade, token] of RULES) {
      const pattern = new RegExp(`\\b${prefix}-zinc-${shade}(?!\\d)`, "g");
      const matches = content.match(pattern);
      if (matches) {
        counts[`${prefix}-zinc-${shade}`] += matches.length;
        content = content.replace(pattern, `${prefix}-${token}`);
        fileChanged = true;
      }
    }

    if (fileChanged) {
      filesChanged++;
      if (!DRY_RUN) writeFileSync(file, content);
    }
  }
}

console.log(`${DRY_RUN ? "[dry run] " : ""}${filesChanged} file(s) changed`);
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k}: ${v}`);
}
