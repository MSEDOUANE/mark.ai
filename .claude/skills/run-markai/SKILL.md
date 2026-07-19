---
name: run-markai
description: Build, run, and drive MarkAI (Next.js 16 dashboard + marketing site). Use when asked to start MarkAI, run its dev server, take a screenshot of its UI, verify a route compiles, check the theme toggle, or smoke-test the app after a change.
---

MarkAI is a Next.js 16 (Turbopack, App Router) agentic-marketing SaaS. Drive it
by starting the dev server, then either `curl` for route/compile checks or
the Playwright driver at `.claude/skills/run-markai/driver.mjs` for real
browser interaction and screenshots. This is a **Windows** project (not
Linux) — every command below is what actually ran, on this machine, in
Git Bash / PowerShell.

All paths below are relative to the repo root (wherever `package.json` /
`next.config.ts` live — that may be the main checkout or a git worktree
under `.claude/worktrees/<name>/`).

## Prerequisites

- **Node v22.21.1**, not the system default. `node --version` at a fresh
  shell here reports an ancient v6 that can't run this project at all.
  Every command below prepends the real Node to `PATH` first:

  ```bash
  export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
  ```

  (PowerShell equivalent: `$env:PATH = "C:\Users\MSI\AppData\Local\nvm\v22.21.1;$env:PATH"`)

- **Hosted Supabase Postgres** — there's no local DB. Real credentials live
  in `.env.local` (gitignored). If you're in a **git worktree** (this repo
  uses them heavily), `.env.local` and `node_modules` do NOT exist there by
  default — see Setup.

## Setup

Run once per fresh worktree (idempotent — safe to re-run):

```bash
# .env.local doesn't exist in a fresh worktree (gitignored) — copy the
# real one from the main checkout.
[ -f .env.local ] || cp "C:/Users/MSI/Desktop/MINE/MarkAI/.env.local" .env.local

export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
npm install
```

`npm install` gives the worktree its own real `node_modules` (a plain
install — no junction/symlink hack needed; that was tried earlier this
session and `npm install` simply replaces it with a real directory anyway).

**If this is the first Playwright use on this machine**, the npm package
alone isn't enough — the actual browser binary is a separate download:

```bash
npx playwright install chromium
```

## Run (agent path)

Start the dev server, then drive it. In this Claude Code environment the
dev server is started via the Browser pane's `preview_start` tool (which
reads `.claude/launch.json`'s `"web"` config — `next dev` with the Node
v22 PATH already baked into `.claude/dev-server.cmd`), not a raw background
shell command:

```
mcp__Claude_Browser__preview_start({ name: "web" })
```

Wait for it to be ready (Turbopack cold start is ~10-15s), then confirm:

```bash
export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000/)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "landing: HTTP $code"
```

### Route/compile smoke check (fastest signal)

Every dashboard route is auth-gated and correctly 307-redirects to
`/login` when compiled clean; a 500 means something's actually broken:

```bash
for r in dashboard "dashboard/generate" "dashboard/library" "dashboard/brands"; do
  printf "%-24s -> " "$r"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 60 "http://localhost:3000/$r"
done
```

### Real browser interaction — `driver.mjs`

`.claude/skills/run-markai/driver.mjs` is a Playwright script. It assumes
the dev server is already up on `http://localhost:3000` (see above).

```bash
export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
node .claude/skills/run-markai/driver.mjs <command>
```

| command | what it does |
|---|---|
| `smoke` | Loads the landing page, clicks "Enter workspace", confirms it lands on `/login` with a real rendered form, checks for console errors. Screenshots: `01-landing.png`, `02-login.png`. |
| `goto <path>` | Navigates to `http://localhost:3000<path>`, screenshots it. E.g. `goto /dashboard` (will show the login redirect target, since it's auth-gated). |
| `theme-check` | Injects real dashboard-pattern markup (card, nested surface, muted/subtle text tiers, the amber CTA button whose text must stay dark in both themes) into the reachable landing page and screenshots it in dark and light `data-theme` — the fastest way to verify the `app-*` CSS tokens (globals.css) without a login session. Screenshots: `theme-dark.png`, `theme-light.png`. |

Screenshots land in `.claude/skills/run-markai/screenshots/`. Reference
copies from a real run are committed there.

**The auth wall is real and by design**: no test credentials are entered
by this driver or by an agent using it — see Gotchas. Everything reachable
without logging in (landing page, `/login`, every dashboard route's
307-redirect / compile status, the `/api/search` route's 401) is fully
verifiable. Anything behind the login form is not, from this driver.

## Run (human path)

```bash
export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
npm run dev   # → opens on :3000. Ctrl-C to stop. Useless headless — a human needs to actually see the window.
```

## Test

```bash
export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"
npx tsc --noEmit        # ~70s, must exit 0
npx eslint .             # ~3 minutes — see Gotchas, do NOT use a short timeout
```

Expected: `tsc` exits 0 with no output. `eslint .` currently reports
**3 errors, 9 warnings** as a known pre-existing baseline (not caused by
this skill or by unrelated changes) — `dashboard-prefs-saved-chip.tsx`,
`dashboard-section-orderer.tsx`, and `stock-photo-picker.tsx` each have a
`react-hooks/set-state-in-effect` error; the rest are unused-var warnings.
If a change adds to this count, that's a real regression; if the count
matches, you're clean.

Low-cost functional test fixtures (no paid API calls) exist via
`npm run db:seed:test` — see `TEST_SCENARIOS.md` at the repo root for the
full scenario list and the seeded test account. This driver does not use
that account (see Gotchas — no credential entry, ever, from this skill).

---

## Gotchas

- **System Node is v6 and unusable.** Every single command — `next dev`,
  `tsc`, `eslint`, `npm install`, `npx playwright` — silently resolves to
  the wrong Node unless `PATH` is prepended first. This is the #1 thing
  that will look like a mysterious failure if skipped.

- **A fresh git worktree has neither `node_modules` nor `.env.local`.**
  Both are gitignored. `npm install` fixes the former cleanly (see
  Setup — don't bother with a junction/symlink to the main checkout;
  `npm install` will just replace it with a real directory the moment
  anything triggers a reinstall, which then desyncs from what you
  expected was there).

- **`lightningcss` native binary can land in the wrong place.** On this
  Windows machine, a plain `npm install` sometimes installs the Windows
  platform binary as its own sibling package
  (`node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node`)
  but the installed `lightningcss` version's loader does a **relative**
  `require('../lightningcss.win32-x64-msvc.node')` from
  `node_modules/lightningcss/node/index.js` — i.e. it wants the file
  directly at `node_modules/lightningcss/lightningcss.win32-x64-msvc.node`.
  When it's missing, `next dev` returns **HTTP 500 on every page** with
  `Cannot find module '../lightningcss.win32-x64-msvc.node'` in the logs
  (globals.css fails to evaluate, since Tailwind v4's PostCSS pipeline
  needs it). Fix:
  ```bash
  cp node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node \
     node_modules/lightningcss/lightningcss.win32-x64-msvc.node
  ```
  **Then you must also delete `.next`** (stop the dev server first — the
  running process locks files under `.next` on Windows and `rm -rf` will
  partially fail with "Directory not empty"). Turbopack caches the
  *compiled failure* on disk; restarting the server process alone is not
  enough, the 500 persists identically until the cache is cleared:
  ```bash
  rm -rf .next
  ```
  Then restart the dev server. This exact sequence (copy → stop server →
  clear `.next` → restart) is what actually resolved it — clearing `.next`
  before stopping the server, or restarting without clearing `.next`,
  both failed to fix it in this session.

- **Playwright's npm package and its browser binaries are separate
  downloads.** `npm install playwright` (or `npx playwright --version`)
  does not fetch Chromium. `chromium.launch()` fails with `Executable
  doesn't exist at ...chrome-headless-shell.exe` until you run
  `npx playwright install chromium` — and if an *older* Chromium build
  happens to already be on the machine (e.g. from an unrelated tool), that
  doesn't help; Playwright wants the exact version pinned to the installed
  `playwright` package version.

- **`npx eslint .` needs 300s+, not the tool default 120s.** A full run
  across this repo takes ~2m50s. Shorter timeouts (120s, even 180s) killed
  the command mid-run in this session with no output at all — it looked
  like a hang, it was just slow. `npx tsc --noEmit` is faster (~70s) and
  fits a normal timeout.

- **The auth wall cannot be crossed by entering a password, ever, from
  this driver.** A test account is documented in `TEST_SCENARIOS.md`
  (`founder@markai.local` / `password123`, seeded via `npm run
  db:seed:test`) — a human operator may choose to use it themselves, but
  an agent must not type any password into the login form under any
  circumstance, including this one. This means every authenticated
  dashboard page, and any UI behind `/login`, cannot be visually verified
  by this driver — only its unauthenticated shell (307 redirects, 401s
  on protected API routes, console-error-free compiles) can be. Design
  around this: prove correctness via DB round-trips (`tsx` scripts
  against the real Supabase instance), compiled-CSS/JS inspection, and
  component-pattern injection into the one reachable page (see
  `theme-check`) — not by trying to force a login.

- **Public pages only get the marketing site's own dark styling; the
  `app-*` theme tokens are dashboard-only.** Injecting dashboard-pattern
  markup onto the landing page (as `theme-check` does) works because both
  share one compiled stylesheet — but don't expect the landing page's
  *own* elements to theme-switch; only the injected snippet does.

## Troubleshooting

- **Every route returns HTTP 500, logs show `Cannot find module
  '../lightningcss.win32-x64-msvc.node'`**: see the lightningcss Gotcha
  above — copy the binary, stop the server, clear `.next`, restart.
- **`chromium.launch()` throws `Executable doesn't exist at
  ...chrome-headless-shell-win64\chrome-headless-shell.exe`**: run
  `npx playwright install chromium` (not just `npm install playwright`).
- **`node driver.mjs smoke` reports `after click, url:
  http://localhost:3000/`** (i.e. the click didn't navigate) with no
  thrown error: a plain `page.click("text=...")` followed by
  `waitForLoadState` can resolve before Next.js's client-side routing
  actually updates the URL. Use `Promise.all([page.waitForURL(...),
  locator.click()])` instead (already fixed in the committed driver).
- **`preview_stop` / a background dev server "disappears" between tool
  calls**: this environment's preview process is flaky and stops itself
  intermittently — this is not caused by anything in the app. Just
  `preview_start({name:"web"})` again; it's a clean, fast restart once
  `node_modules`/`.env.local` are already in place.
- **`npx eslint <specific files>` times out at 120-180s with zero
  output**: not a hang — full-repo-aware ESLint (flat config, type-aware
  rules) is just slow here. Re-run with a 300-480s timeout.
