# MarkAI — Handoff / Continuation Prompt

Paste this whole file (or just link to it) at the start of a new thread to pick up where this session left off. Companion file: [`SESSION_CHANGELOG.md`](./SESSION_CHANGELOG.md) has the full phase-by-phase build log with file paths.

## What MarkAI is

An agentic marketing SaaS: Next.js 16 (App Router, Turbopack) + Supabase (hosted Postgres) + Drizzle ORM + Inngest (background jobs) + fal.ai (all image/video/audio generation) + Claude via the Vercel AI SDK. Primary market is **Morocco / MENA**, Arabic-first with Moroccan Darija as the default dialect.

Repo: `https://github.com/MSEDOUANE/mark.ai.git`, branch `main`.

## ⚠️ Fix this first: `main` currently fails `tsc --noEmit`

A commit from another contributor (`7463823 "new changes"`, authored by `msedouane2`) rewrote the Generate hub's category taxonomy:

```ts
// src/app/dashboard/generate/page.tsx
const CATEGORIES = ["Most Popular","Images","Videos","Product Ads","Social Posts","Text","Audience","Voice","Audio","Animation"] as const;
```

`"All"` was removed from that list, but ~17 tile definitions in the same file (mine and others') still have `categories: ["All", "Images"]` etc. Result: **17 `tsc` errors**, all `Type '"All"' is not assignable to type '"Videos" | "Voice" | ...'`. This is the current state of `main` — not something introduced by this session's Arabic/MENA work (that work typechecked clean before this commit landed on top of it).

Fix is mechanical: either add `"All"` back to `CATEGORIES`, or replace every `"All"` in each tile's `categories` array with the actual category (or drop the "All" filtering concept if the new tab bar doesn't need it — check how `CATEGORIES` is consumed in the JSX further down the file first). Do this before anything else; nothing else can be verified against a broken build.

## Environment gotchas (read before running anything)

- **Node version**: system default is v6 (ancient, unusable). Every `node`/`npm`/`npx`/`tsc`/`eslint` call needs `C:\Users\MSI\AppData\Local\nvm\v22.21.1` prepended to `PATH` first. In Bash: `export PATH="/c/Users/MSI/AppData/Local/nvm/v22.21.1:$PATH"`.
- **Database**: hosted Supabase Postgres, not local Docker. `drizzle-kit push` is unusable in this environment (no interactive TTY). Schema changes go through **raw SQL scripts** run with `tsx`, e.g.:
  ```ts
  // scripts/add-whatever.ts
  import { config } from "dotenv"; config({ path: ".env.local" });
  async function main() {
    const { db } = await import("../src/db/index");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  ```
  Run with `npx tsx scripts/add-whatever.ts`. Always update `src/db/schema.ts` to match by hand — Drizzle won't introspect the DB for you here. **Never run a blanket `UPDATE table SET col = x` with no `WHERE`** — the sandbox's safety classifier blocks it, and correctly so; scope every data-mutating script to specific rows/ids.
- **fal.ai account balance is exhausted** (`403 User is locked. Reason: Exhausted balance`). Every fal-backed feature (image/video/audio generation) has its request → API call → error-handling pipeline verified, but not final visual/audio output. Top up at fal.ai/dashboard/billing to unlock full verification. Don't treat a 403 from fal as a bug — it's confirmed to be this billing block, consistently, across every phase.
- **Dev server / browser session**: the dev server crashed once mid-session (unrelated cause) and was restarted via `preview_start({name:"web"})`. The restarted session's browser has **no login cookie** and no credentials are available to log back in — Phases 7 onward (Brand Kit v2, Asset Library, Batch Generation, Team Invites, Organic Publishing, MENA/Arabic content generation) shipped on `tsc` + `eslint` clean only, **not live browser verification**. If you have credentials, log in first and spot-check those phases — they were never visually confirmed.
- **Check git before assuming file state** — `git log --oneline -20` and `git status` before assuming you know the current state of any file this session touched. (Correction, verified 2026-07-17: the earlier claim of "multiple active contributors" was overstated. Billing / Team Management / Notifications / Profile / Preferences / Animation Studio all arrived in a single squashed commit `7463823 "new changes"` authored by `msedouane2` — the same account as this session's work. The only genuinely external commit is `joba48`'s one hydration/Server-Component fix `7fb15ac`.)

## Architecture patterns to reuse (don't reinvent these)

- **fal.ai model registry**: `src/lib/creative/image-models/registry.ts` — one file per model (`fal-nano-banana.ts`, `fal-flux-redux.ts`, `fal-kling-video.ts`, etc.), each exporting a typed `generate` function. Registry maps logical roles (`TEXT_MODELS`, `IMG2IMG_MODEL`, `COMPOSE_MODEL`, `VIDEO_MODEL`) to implementations — swap providers by changing one import. Sync models call `fal.run/{model}` directly; slow models (video, avatars) use `queue.fal.run/{model}` submit → poll `status_url` → fetch `response_url`.
- **Claude/text generation**: `src/lib/ai/models.ts` exports `strategistModel` (`claude-haiku-4-5`, the default workhorse) and `copywriterModel` (`claude-opus-4-8`, used for creative-wizard headline refinement). Every text tool uses the Vercel AI SDK's `generateObject` with a Zod schema — never raw HTTP. No `temperature`/`top_p` passed anywhere (Opus 4.8 adaptive-thinking 400s if you do).
- **Server actions + `useActionState`**: every Generate-hub tool follows the same shape — a `"use server"` actions file exporting `async function generateX(prevState, formData): Promise<XState>` where `XState = {status:"idle"} | {status:"success", result, ...} | {status:"error", message}`, paired with a client component calling `useActionState(generateX, {status:"idle"})`. Copy this pattern exactly for any new AI tool.
- **Brand voice threading**: `src/lib/ai/tool-context.ts`'s `readBrandContext(formData)` pulls brand name/tone/description/voiceNotes from `<BrandContextPicker>`'s hidden fields into prompt lines; `saveGeneration()` persists every tool's output to the `generations` table. Reuse both in any new text tool.
- **Language/dialect threading** (new this session): `src/lib/ai/languages.ts` exports `LANGUAGES` (Arabic first), `ARABIC_DIALECTS` (5 dialects, Darija first/default), and `languageDirective(language, dialect)` — one prompt line to prepend. `src/components/language-picker.tsx` is the reusable UI (language select + conditional dialect select), defaulting to `ar`/`darija`. Every text tool should call `languageDirective()` and render `<LanguagePicker />` — see `SESSION_CHANGELOG.md` for the full list already wired.
- **Brand Kit resolution for rendered creatives**: `src/lib/creative/resolve-artwork.ts`'s `resolveCreativeArtwork(creative)` merges brand data from the product snapshot → the product's brand profile (font/secondary/accent/default-template) → any inline `meta.brand` override (highest precedence). Shared by both the single-image render route and the "download all sizes" zip route — extend this, don't duplicate it, if you touch creative rendering again.
- **Auth/org model**: `src/lib/auth/ensure-profile.ts`'s `ensureProfile(user)` bridges Supabase auth → `profiles`/`memberships`/`organizations`. **The app is explicitly single-tenant today** — every new user auto-joins the one org as `"owner"`. The team-invite flow (`src/app/invite/[token]/actions.ts`) works around this by running the same bridge then updating the resulting membership's role — it does not implement real multi-org logic. If true multi-tenancy is ever needed, `ensureProfile` is the file to change, carefully.
- **Middleware public-path allowlist**: `src/lib/supabase/middleware.ts`'s `PUBLIC_PATHS` gates every route behind auth by default. Any new public-facing route (like `/invite/[token]` or `/p/[slug]`) must be added there explicitly — this was a real bug caught and fixed this session (the invite page redirected to `/login` before it could show its own "log in to accept" branch).

## What this session built (summary — full detail in SESSION_CHANGELOG.md)

Two big bodies of work, both merged to `main` and pushed:

**1. A 9-phase roadmap mapping AdCreative.ai's 74-service catalog onto MarkAI** (user-approved plan, executed phase by phase, each phase = one commit, `tsc`+`eslint` gated):
- P1 Taxonomy: sectioned sidebar (Generate/Brands/Projects/Analyze/Predict/Retouch), expanded Generate hub tiles
- P2 Retouch suite: background removal, upscale, enhance, object removal, cleanup, restoration (3 new fal models, 1 page)
- P3 Image Studio: variations, background generation, instruction editing, Fashion Photoshoots, photo→video animate
- P4 Text tools: Product Descriptions, Marketing Copy, Audience Insights, Meta targeting spec on Personas
- P5 Audio Studio: voice/music/SFX + background music in Video Studio
- P6 Analyze & Predict: competitor analysis (live Meta Ad Library + AI report), website analysis, ad-fatigue detection rule, creative scoring estimates (labeled "AI estimate")
- P7 Brand Kit v2: secondary/accent colors, Google Fonts in rendered creatives (real font loading for Satori/next-og), asset gallery, default template, Brand Learning (AI drafts voice-consistency notes from past generations)
- P8 Asset Library (unified feed across creatives/generations/videos/pages), creative tags, multi-format export (hand-rolled ZIP writer, no dependency), Batch Generation (one brief × N products)
- P9 Team invites/roles (`pending_invites` table, accept flow, Settings UI) + organic Meta Page publishing (separate from the existing paid-ads launch path)

**2. Arabic/MENA adaptation** (explicit user request, scoped via `AskUserQuestion` to the AI-content-generation layer only — UI translation/RTL and in-image Arabic text rendering were explicitly deferred as separate, larger undertakings):
- Every text-generation tool (Ad Copy, Product Descriptions, Marketing Copy, Personas, Audience Insights, Social Captions, Landing Pages) now defaults to Arabic / Moroccan Darija via the shared `LanguagePicker`
- Video Studio + Audio Studio's existing (but opt-in) Arabic support flipped to default-on
- Landing pages gained a `language` column so the public `/p/[slug]` template can set `dir="rtl"` correctly

## Explicitly deferred / natural next steps

- **Fix the `tsc` break above** — ✅ DONE (commit `4ca5c94`). The `"All"` sentinel was still load-bearing for the Most-Popular filter; fixed by widening `AssetType.categories` to `(Category | "All")[]` rather than editing 17 tiles.
- **UI translation + RTL layout for the dashboard admin interface** — user explicitly deferred this as a separate, much larger project when scoping the Arabic/MENA work. Don't start it without re-confirming scope.
- **Arabic text rendered directly inside generated ad-creative images** — ✅ SPIKE DONE + FIXED (commit `cf875da`). Finding: Satori/next-og's Arabic *shaping and bidi are actually good* (connected letterforms + RTL render correctly). The real blocker was fonts — next/og's built-in font has no Arabic glyphs and its shaper *throws* on Arabic ("lookupType: 5 - substFormat: 3"), 500-ing the whole render (not just tofu). Fixed by auto-loading Cairo (Arabic Google Font) in `loadBrandFonts` whenever the text contains Arabic; Satori's per-glyph fallback keeps Latin on the brand font. Verified by rendering no-font / Latin-font / Arabic-font cases — all correct now. (Remaining nicety if desired: let brands pick an Arabic display font instead of the Cairo default; not required for correctness.)
- **Campaign strategist / creative wizard language support** — ✅ DONE (commit `ff1c12c`). `generateStrategy()` now localizes all human-readable output via `languageDirective()`, defaulting to Arabic/Darija, with `creativePrompt` kept English. Brief form + standalone creative wizard (AI-copy mode) got the shared `<LanguagePicker/>`. Scope was user-confirmed (picker default-Arabic; localize everything).
- **Live browser verification of Phases 7–9 and the MENA work** — never done (see environment gotchas above). Worth a pass once you have login access.
- **Familiarize with the `7463823` feature drop** — Billing, Team Management, Notifications, Profile, Preferences, Animation Studio, and a dashboard customization/section-reordering system all landed in that one commit. Read `docs/implementation-specs.md` (already in the repo) for the forward-looking route/component spec those changes are working toward. (Correction, 2026-07-17: the feared team-invite *duplication* did not exist — `team/page.tsx` and the old Settings team section shared one actions file, not two competing implementations. Now consolidated: team management lives solely at `/dashboard/team`, actions at `src/app/dashboard/team/team-actions.ts`, and Settings just links to it. See commit `0e31aac`.)

## Standing working rhythm (established over the whole session)

- Build the real feature, not a stub.
- `tsc --noEmit` clean + `eslint` clean (0 new errors; check any pre-existing warnings are the ones already known, not new) before every commit.
- Verify live via the browser when possible; when fal.ai's billing block or a missing session makes that impossible, say so explicitly rather than claiming it was tested.
- Commit with a detailed message explaining what shipped and what was verified how; push to `main` without asking each time (this has been pre-authorized for the whole session).
- Prefer editing/extending existing patterns over introducing new ones.
