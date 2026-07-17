# MarkAI — Session Changelog (74-service roadmap + MENA adaptation)

Detailed companion to [`HANDOFF.md`](./HANDOFF.md). One section per commit, in order, with what shipped and where. All commits are on `main`, pushed to `https://github.com/MSEDOUANE/mark.ai.git`.

---

## Context: how this roadmap started

The user shared a screenshot of AdCreative.ai's Generate hub (a 74-item service catalog spanning Generate/Video/Text/Audience/Sound/Brands/Projects/Analyze/Predict/Retouch/Automation & Publishing/AI Intelligence) and asked for feature parity. An inventory pass found **~31 services already existed**, **~28 were small extensions**, and only **~15 were genuinely new builds** — about 26 items were deliberately "thin" (tile aliases, deep-links, taxonomy relabels) rather than separate pages, mirroring how AdCreative itself inflates ~15 real capabilities into 74 catalog items.

Plan mode produced a 9-phase build order (`radiant-tumbling-stearns.md`, saved under `.claude/plans/` at the time — may not exist in a new session). User confirmed via `AskUserQuestion`:
- Team collaboration → defer to last phase
- Direct publishing → export-first now, real posting only in the last phase
- Predict → ship as clearly-labeled Claude-based AI estimates (no real ML model, no training data)

---

## Phase 1 — `e02377c` "Reorganize dashboard into AdCreative-style service sections"

Sectioned `src/app/dashboard/sidebar-nav.tsx` into Generate/Brands/Projects/Analyze/Predict/Retouch/Settings groups. Expanded `src/app/dashboard/generate/page.tsx` with thin tiles for Headlines/CTAs/Primary Text (anchor links into the Ad Copy tool), Product Videos, Motion Effects, Fashion Photoshoots ("Soon"), Audio ("Soon"). Zero backend changes.

## Phase 2 — `a36c682` "Add Retouch suite: 6 one-click photo tools"

New fal model files mirroring `fal-flux-redux.ts`: `fal-bg-remove.ts`, `fal-clarity-upscaler.ts`, `fal-eraser.ts`, registered as `RETOUCH_MODELS` in `registry.ts`. `src/app/api/retouch/route.ts` + `src/app/dashboard/retouch/` (page + client) — 6 tool tiles (Background Removal, Upscale, Enhance, Object Removal, Cleanup, Restoration) over 3 underlying models. Object removal has a canvas mask-draw UI. Results persist as `creatives` rows tagged `meta.tool="retouch"`.

## Phase 3 — `176198d` "Add Image Studio + Fashion Photoshoots + photo-to-video animate"

- `src/lib/ai/photoshoot-styles.ts`: added a `category` field (`"product" | "fashion"`) and 4 on-model fashion styles, reusing the existing `COMPOSE_MODEL` route unchanged.
- New `/dashboard/generate/image-studio`: Variations (`IMG2IMG_MODEL`), Background Generation (bg-remove → `COMPOSE_MODEL` re-scene), Instruction Edit (`fal-nano-banana-edit.ts`) — one page, mode tabs, one `/api/image-studio` route.
- New stateless `/api/animate-photo` (turns any photo into a short clip via `VIDEO_MODEL`/Kling) with an "Animate → video" button on Product Photo Ads results.
- Product Photo Ads page got a Product/Fashion category toggle (`?category=fashion` deep-link from the Generate hub tile).

## Phase 4 — `5acfc0d` "Add Product Descriptions, Marketing Copy, Audience Insights, and Meta targeting spec"

- Ad Copy page renamed "Copy & Content" with 3 tabs sharing brand context: Ad Copy (unchanged), Product Descriptions (short/medium/long + bullets + SEO metadata), Marketing Copy (Email/Landing Hero/Blog Intro/SMS). New `src/app/dashboard/generate/ad-copy/content-actions.ts`.
  - Real bug caught+fixed: a `"use server"` file can only export async functions — `MARKETING_FORMATS` const had to move to its own `marketing-formats.ts`.
- New `/dashboard/generate/audience-insights`: standalone market segmentation (3-5 segments), lighter-weight than the campaign-bound `researcher.ts` (no web search).
- Personas gained a `metaTargeting` field per persona (age/gender/placements/interests/detailed-targeting) — a ready-to-paste Meta Ads Manager spec.
- **Verified live with real Claude output** (this phase doesn't depend on fal.ai) — confirmed real generated product descriptions, marketing copy, audience segments, and a fully-populated Meta targeting spec.

## Phase 5 — `e39de04` "Add Audio Studio (voice/music/SFX) + background music in Video Studio"

- `musicGenerate` (`fal-ai/stable-audio`) and `sfxGenerate` (`fal-ai/elevenlabs/sound-effects/v2` — the v1 endpoint is deprecated) added to `fal-audio-video.ts`, both on the queue submit/poll pattern.
- New `/dashboard/generate/audio`: Voice/Music/SFX tabs, one stateless `/api/audio-studio` route.
- Video Studio gained an optional "Background music" field; `video_projects.music_prompt` column added (raw ALTER, `scripts/add-music-prompt-column.ts`); render pipeline generates a music bed and layers it as a second audio track in the ffmpeg compose.

## Phase 6 — `6d0c603` "Add Analyze and Predict sections"

Biggest phase. `/dashboard/analyze`: Competitor Analysis (live Meta Ad Library search via the org's connected ad-account token + a standalone AI competitor report), Website Analysis (new `/api/website-analysis`, same fetch+strip skeleton as `/api/brand-import` but a richer schema — value prop/messages/offers/weaknesses/suggested ad angles — plus a "Start a campaign for this" hand-off that prefills the campaign brief wizard), Creative Insights (folded into the existing scored-creatives view rather than building a page against data that doesn't exist yet — entity-level actual CTR isn't wired to any writer).

`/dashboard/predict`: ranked creatives with a "Predicted winner" badge, real ad-fatigue alerts, all under an explicit "AI estimates, not measured data" banner. `creative-scorer.ts` gained `predictedCtrBand`/`conversionLikelihood`. `anomaly.ts` gained an `ad_fatigue` rule (frequency climbing >1.3x baseline while CTR softens — distinct from the existing sudden-drop `ctr_collapse` rule); `alerts.type` is free text so no migration was needed.

`brief-form.tsx` gained `initialProductName`/`initialProductDescription`/`initialWebsiteUrl` props read from `campaigns/new`'s searchParams — this is the Website-to-Ad prefill chain.

**Verified live**: real accurate report for stripe.com, real specific competitor analysis (The Ordinary, Moroccan artisan brands, Biossance) for a Morocco skincare brief, real Ad Library permission error surfaced correctly (external Meta app config issue, not a bug).

## Phase 7 — `47e32f4` "Add Brand Kit v2"

`brand_profiles` gained `font_family`, `secondary_color`, `accent_color`, `assets` (jsonb gallery), `default_template`, `voice_notes` (raw ALTER, `scripts/add-brand-kit-v2-columns.ts`). `brand-form.tsx`: color pickers, a curated Google Fonts select, a template picker, an asset gallery, a voice-notes textarea.

`design.tsx`: real Google Font loading for `next/og`/Satori — `loadBrandFonts()` fetches actual TTF/OTF bytes (400+700 weights, scoped to the creative's own text) since Satori can't resolve family names on its own, only render glyphs from font data you hand it. Secondary color renders as a small accent-bar dot in all 3 templates. `/api/creatives/[id]/route.tsx` now also resolves the creative's brand profile (via `product.brandProfileId`) to pick up font/secondary/accent/default-template even though logo/primary still come from the product snapshot.

Brand Learning: `proposeBrandVoiceNotes` — Claude reads a brand's past Generate-tool outputs and drafts consistency notes; user reviews and explicitly applies, nothing auto-writes. `voiceNotes` now threads through `BrandContextPicker` → `readBrandContext()` into every text tool's prompt.

**Not live-verified** — dev server crashed partway through this phase (see HANDOFF.md environment gotchas); shipped on `tsc`+`eslint` clean only, per explicit user confirmation of that fallback.

## Phase 8 — `db87271` "Add Asset Library, creative tags, multi-format export, and Batch Generation"

`/dashboard/library`: unified feed across creatives/generations/video-projects/landing-pages, type tabs, counts. Tags via `creatives.meta.tags` (no migration) + `TagEditor` component + filter chips in `CreativesToolbar`. `CREATIVE_SIZES` gained a `landscape` (1600×900, 16:9) size. `src/lib/zip.ts`: hand-rolled "stored" (no-compression) ZIP writer with CRC32, no dependency — new `/api/creatives/[id]/zip` bundles every size into one download. Extracted the brand/template resolution shared by the single-image route and the new zip route into `src/lib/creative/resolve-artwork.ts` (don't duplicate this again).

Batch Generation: new Inngest function `batch-generate.ts` (`creative/batch.requested`) — one shared brief × N products, each product's copy generated in its own `step.run` (isolated failure), fans into the existing `creative/generate.requested` pipeline via `step.sendEvent`. New `/dashboard/generate/batch` trigger page.

## Phase 9 — `c0f30e5` "Add team invites and organic Meta Page publishing"

`pending_invites` table (raw `CREATE TABLE`, `scripts/add-pending-invites-table.ts`, reuses the existing `membership_role` enum). `inviteMember`/`cancelInvite`/`changeMemberRole`/`removeMember` actions gated to owner/admin, with a last-owner guard. Public `/invite/[token]` accept page — **the app is single-tenant** (`ensureProfile` bridges every user into the one org as owner), so accepting works by running that same bridge then updating the resulting membership's role to what was invited, not by implementing real multi-org logic. Settings gained a Team section.

**Real bug caught+fixed during verification**: `src/lib/supabase/middleware.ts`'s `PUBLIC_PATHS` didn't include `/invite`, so logged-out visitors got redirected to `/login` before ever seeing the invite page's own "log in or sign up to accept" branch. Fixed by adding `/invite` to the allowlist — this is the one thing in this whole roadmap that WAS live-verified (public route, no auth needed): confirmed "invite not found" for an invalid token, then created a real pending invite row and confirmed it loads correctly and shows the logged-out branch.

Organic publishing: `src/lib/ads/organic-publish.ts` (`publishPhotoToPage`, `getPageAccessToken`) — separate from the existing paid-ads launch path in `meta.ts`, no budget/approval gate. New panel on the existing creative publish page. Requires `pages_manage_posts` scope on the Meta connection. **Never fired against a live Facebook Page during testing**, deliberately, to avoid an unintended real post.

This closed the 9-phase roadmap.

---

## Follow-up — `f135fa8` "Adapt AI content generation for Arabic/MENA users"

User request: "the [app] is oriented to arabic users MENA region so you need to adapt it for that." Scoped via `AskUserQuestion` (2 questions) before building:
1. Which layers → user picked **"AI content generation"** only (not UI translation/RTL, not in-image Arabic text rendering — both explicitly deferred as separate, larger projects)
2. Primary market → **Morocco** (matches existing MAD-currency-default, Darija-default-in-Video-Studio precedent)

Built:
- New `src/lib/ai/languages.ts`: `LANGUAGES` (Arabic first), `ARABIC_DIALECTS` (moved out of `video-script.ts`, re-exported there for existing importers), `languageDirective(language, dialect)`.
- New `src/components/language-picker.tsx`: language + conditional dialect select, defaulting to `ar`/`darija`, mirroring Video Studio's existing `VoicePicker`.
- Wired into: Ad Copy, Product Descriptions, Marketing Copy, Personas (targeting keywords deliberately kept in English — they paste directly into Meta Ads Manager), Audience Insights, Social Captions, Landing Pages.
- Video Studio's `VoicePicker` and Audio Studio's language state switched their default from `"en"` to `"ar"` (dialect support already existed, just wasn't the default). `VOICE_LANGUAGES` reordered Arabic-first.
- `landing_pages` gained a `language` column (raw ALTER, `scripts/add-landing-page-language.ts`) so `/p/[slug]` can set `dir="rtl"` and localize its one hardcoded string ("Questions" → "الأسئلة الشائعة") when the content is Arabic.
- **Real bug caught+fixed**: the `ADD COLUMN ... DEFAULT 'ar'` migration backfilled the one pre-existing landing page (generated before Arabic support existed, actually English content) as `'ar'`. Corrected that single row by id (not a blanket UPDATE — the sandbox's safety classifier correctly blocks unscoped UPDATEs) and fixed the column default to `'en'`.

**Not live-verified** — same session-login blocker as Phases 7-9.

---

## Full file-path index (new files this session, roughly grouped)

```
src/lib/ai/languages.ts                                   — shared language/dialect module
src/components/language-picker.tsx                        — shared language+dialect UI
src/lib/zip.ts                                             — hand-rolled ZIP writer
src/lib/creative/resolve-artwork.ts                        — shared brand/template resolution
src/lib/ads/organic-publish.ts                             — organic Meta Page posting

src/app/dashboard/retouch/                                 — Retouch suite
src/app/dashboard/generate/image-studio/                   — variations/bg-gen/instruction-edit
src/app/dashboard/generate/audience-insights/               — audience segmentation tool
src/app/dashboard/generate/audio/                           — voice/music/SFX
src/app/dashboard/generate/batch/                           — batch generation trigger
src/app/dashboard/analyze/                                  — hub + competitors/ + website/
src/app/dashboard/predict/                                  — ranked creatives + fatigue alerts
src/app/dashboard/library/                                  — unified asset library
src/app/invite/[token]/                                     — team invite accept flow
src/app/api/retouch/route.ts
src/app/api/image-studio/route.ts
src/app/api/animate-photo/route.ts
src/app/api/audio-studio/route.ts
src/app/api/website-analysis/route.ts
src/app/api/creatives/[id]/zip/route.ts

src/inngest/functions/batch-generate.ts

scripts/add-music-prompt-column.ts
scripts/add-brand-kit-v2-columns.ts
scripts/add-pending-invites-table.ts
scripts/add-landing-page-language.ts
```

Every DB migration above was run against the **hosted** Supabase instance via `npx tsx scripts/<name>.ts` — `src/db/schema.ts` was hand-updated to match each one.
