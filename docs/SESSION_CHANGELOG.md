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

---

## Video model swap — cheaper custom avatars, higher-quality scene clips

**Why:** OmniHuman ($0.14/s) made a 30s bring-your-own-photo avatar video cost ~$4.20, and Kling 2.1 *standard* scene clips looked soft. Research (July 2026 pricing) showed the fix is swapping **models**, not providers — fal.ai itself hosts cheaper/better options, so no new API key or integration pattern was needed.

**Custom avatar (BYO photo + audio):** `fal-ai/bytedance/omnihuman` → **`fal-ai/kling-video/ai-avatar/v2/standard`** ($0.0562/s — **60% cheaper**, a 30s video drops $4.20 → ~$1.69). Bonus: audio cap doubles 30s → 60s, so `generate-video.ts`'s narration budget went 55 → 130 words (retry fallback 32 → 70). `omnihumanGenerate` was renamed `customAvatarGenerate` and the endpoint pinned in `fal-audio-video.ts` (rollback endpoint documented in the function comment). The audio-too-long retry now matches error text loosely (`/audio.{0,40}(duration|too.?long|exceed)/i`) since Kling's error string differs from OmniHuman's `audio_duration_too_long`.

**Scene image-to-video:** `kling-video/v2.1/standard` ($0.05/s) → **`kling-video/v2.6/pro`** ($0.07/s, +$0.10 per 5s scene) for a major motion/detail quality jump. Two schema landmines handled in `fal-kling-video.ts`: the param is **`start_image_url`** (2.1 used `image_url`), and **`generate_audio` defaults to `true` which silently doubles the price to $0.14/s** — explicitly set `false` because the pipeline lays its own TTS voiceover + music in the compose step.

**Alternatives priced and rejected:** OmniHuman on WaveSpeed ($0.12/s — marginal saving, new provider integration + key); InfiniteTalk on WaveSpeed ($0.03–0.06/s — cheapest, but wan-based quality is a downgrade and quality was half the complaint); OmniHuman 1.5 on fal ($0.16/s — better quality but *more* expensive); fal's own InfiniTalk ($0.20/s — overpriced there).

**Verification honesty:** `tsc` + `eslint` clean; request/response shapes match fal's published API schemas. **No live render was possible — the fal balance is still exhausted (known 403 billing block).** First real render after top-up should be watched: if Kling AI Avatar rejects a `data:` URI photo or the 2.6 payload errors, the old endpoints are one-line rollbacks documented in each file's header.

---

## Refine-with-feedback: a "conversation" across all Generate-hub text tools

**Why:** user asked whether AI-generated content could hold the conversation of its creation and keep improving with feedback, instead of every generation being a one-shot throwaway. Scoped via `AskUserQuestion`: **all** Generate-hub text tools (not just one), interaction style = a **free-form feedback box** (not a structured chat thread, not just exposing the existing auto-refine loop).

**Mechanism** — `generations` gained two columns (`scripts/add-generation-thread-columns.ts`): `parent_id` (self-FK, nullable) and `feedback` (text, nullable). A generation's ancestry chain *is* the conversation — no new table needed. `saveGeneration` (`src/lib/ai/tool-context.ts`) now returns the inserted row's id (was `void`) and accepts `parentId`/`feedback`. Three new shared helpers in the same file:
- `loadRefineParent(formData, orgId)` — org-scoped lookup of the generation a refine round continues from (reads `refineGenerationId` off the form).
- `readRefineFeedback(formData)` — the user's free-text note (`refineFeedback`).
- `refineDirective(previousOutput, feedback)` — appended to the tool's prompt: previous JSON output + the feedback + an instruction to fully incorporate it, not lightly restate the old result.

Every one of the 9 tools (ad-copy, social-captions, personas, audience-insights, marketing-calendar, brand-safety, funnel-design, email-marketing, content-planner) got the same small diff to its `actions.ts`: load the refine parent, make every `field()` lookup fall back to the parent's stored `input` JSON when the form didn't resubmit it (a refine round only ever POSTs `refineGenerationId` + `refineFeedback` — none of the tool's own fields), append `refineDirective` to the prompt when refining, and save the new generation with `parentId`/`feedback` set. Each tool's `State` success variant gained one field: `generationId: string`.

**UI** — `src/components/refine-panel.tsx`: a `<RefinePanel>` component (feedback textarea + submit button, submits through the SAME `useActionState` `formAction` so the result area updates in place) plus a `useRefinementRounds(state)` hook that accumulates a client-side round log (round number + the feedback that drove it) as `state` moves through successive successful generations — feedback text is captured synchronously at submit time since the server state doesn't echo it back. Dropped into all 9 generator client components with a 2-3 line diff each.

**Scope cuts, documented rather than silently decided:**
- No cross-page-load persistence of the round log — it's client-side session state, lost on refresh (though the underlying DB chain persists forever via `parentId`; a future "resume this thread" feature could read it back, not built).
- No "restore an older round" — unlike brand-profile version history, there's no single canonical row to overwrite; the latest `useActionState` result IS the current state. Read-only history only.
- `batch` (Inngest trigger, no `generateObject` call) and `scheduler`'s DB-mutation actions (`schedulePost`/`cancelScheduledPost`/`restoreScheduledPost`) are out of scope — not content generation.

**Verified live** against the real Anthropic API + hosted Supabase via a throwaway spike (`scripts/tmp-verify-refine-loop.ts`, deleted after): round 1 generated real ad copy; round 2, using the actual `loadRefineParent`/`readRefineFeedback`/`refineDirective`/`saveGeneration` functions with a real `FormData`, asked for a specific discount + CTA change — the refined output kept the working headline and incorporated both requested changes exactly, and the DB round-trip confirmed `parentId`/`feedback` persisted correctly. `tsc` and `eslint` both clean (eslint's 3 errors/9 warnings are the pre-existing baseline, unchanged).

---

## Review pass on refine-with-feedback: 3 defects found and fixed

A model-switch review (Fable reviewing Sonnet's commit `b2b9fda`) confirmed the mechanism sound (org-scoping, self-FK schema, input fallbacks, live verification all genuine) but caught three real defects:

1. **Two tools missed.** `generateProductDescription` and `generateMarketingCopy` live in `ad-copy/content-actions.ts` (sibling tabs of the ad-copy page), not their own directories, so the "one actions.ts per tool" survey missed them. Both now fully wired (actions + `RefinePanel` in `product-description-generator.tsx` / `marketing-copy-generator.tsx`), including a `formats` getAll-fallback mirroring ad-copy's `frameworks` handling. **11 tools total now, not 9.**

2. **Brand voice silently dropped on every refine round.** The `BrandContextPicker` hidden fields live in the main form; `RefinePanel` is its own `<form>`, and the brand fields were never persisted into the generation's `input` — so `readBrandContext` returned empty lines on refines and the refined output could drift off-brand. Fix: `readBrandContext(formData, savedInput?)` now falls back to the parent's stored input, `BrandContext` gained a `fields` record, and every tool spreads `...brand.fields` into its saved `input`. Verified against the real DB: a refine-round FormData carrying only the two refine fields reconstructs all 4 brand-voice prompt lines. **Caveat: only generations created after this fix carry the brand fields — refining an older generation still loses brand voice (graceful, same as pre-fix).**

3. **Round-log misattribution in `useRefinementRounds`.** (a) A fresh main-form generation was appended to the previous thread's log as "Round N: original generation" — it now resets the log (server-side it starts a new parentless chain, so the client log matches). (b) A *failed* refine left its feedback in the pending ref, which would be falsely attributed to the next success — an error state now clears it.

`tsc` clean; eslint clean on all touched files (baseline elsewhere unchanged).

---

## Refine "already generated content" — the generation thread page

**Why:** refine-with-feedback only worked on the result still on screen in the current session. The user asked for it on *past* content too. The refine chain already persisted in the DB (`parentId`/`feedback`), but nothing surfaced it, and the Library's text cards linked to `/dashboard/generate/${tool}` — which 404'd for 6 of the 11 tool strings (`marketing-calendar`, `funnel-design`, `email-marketing`, `content-planner`, `product-description`, `marketing-copy` aren't route segments) and dead-ended at a blank form for the rest.

**Built:**
- **`/dashboard/generations/[id]`** — a server-rendered thread page showing a stored generation's full lineage (root → this version), read from the DB so it survives reloads (fixes the earlier client-only round-log scope cut). Each version shows the feedback that produced it + its output; a feedback box at the bottom continues the conversation.
- **`loadGenerationThread(id, orgId)`** / **`loadNewerVersion(id, orgId)`** in tool-context.ts — org-scoped ancestry walk (depth-capped, cycle-guarded) and direct-child detection.
- **`GenerationOutput`** (`src/components/generation-output.tsx`) — one recursive renderer for all 11 tools' output shapes (strings, chip lists, object cards, nested objects), with a legacy double-encoded-jsonb string guard. No per-tool renderer duplication.
- **`refineGeneration`** dispatch action (`generations/actions.ts`) + **`dispatch.ts`** (DISPATCH map over all 11 tool actions) — a refine from the thread page runs the *same* tool action with a refine-round FormData, so zero refine logic is duplicated. `redirect`s to the new version's thread on success.
- **Library** now links text cards to the thread page and shows only **leaf** generations (the tip of each chain) — one card per conversation instead of one per round. Also fixes the 6 latent 404s above.
- Bridge link ("Open full history →") from the live-tool RefinePanel into the durable thread.

**Adversarial review (5-dimension workflow + per-finding verify) caught 2 real defects, both fixed:**
1. **HIGH / build-breaker `tsc` can't see:** `isRefinable` was a *synchronous* export in a `"use server"` file — Next forbids non-async exports there, so the whole route (and every Library text card linking to it) would fail to compile. A verifier ran Next's SWC transform to confirm. Fixed by splitting the const map + sync helper into a plain `dispatch.ts`, leaving only the async `refineGeneration` in the `"use server"` file.
2. **MEDIUM:** opening a mid-chain version mislabeled it "Latest"/"full conversation" and refining it forked a hidden branch. Fixed: Library shows only leaves; the thread page detects a newer child (`loadNewerVersion`), suppresses the "Latest" badge, shows a "go to newer version →" link, and only allows refining from the tip.

**Verified:** `tsc` + `eslint` clean. Live DB spike (9/9 checks) against real hosted Supabase — a real 3-version chain (v2 via a real Claude refine that correctly applied "add 20% off"), `loadGenerationThread` ordering, `loadNewerVersion` child-vs-tip detection, and the Library leaf-filter all confirmed. The authenticated page render itself is behind the login wall (not driveable headless); the build-breaker fix was proven structurally (the `"use server"` file now has exactly one export, async) plus tsc/eslint/import-resolution, not via a production build (skipped to avoid corrupting the running dev server's `.next`).

**Known limitation:** the Library leaf-filter is computed within the 100-row query window, so a parent whose only child fell outside the window could still show as a card — acceptable given the pre-existing 100-row cap.

---

## Refine generated VIDEOS with feedback (script revision + version history)

**Why:** the same "keep enhancing with feedback" ask, now for videos. Videos are a different architecture from text — they live in `video_projects` (not `generations`), the AI artifact is the *script* (`VideoScript`: hook + scenes{visual,motion,voiceover,duration} + ctaLine), and re-rendering is expensive (fal credits) and async (Inngest, minutes). The editor already had per-scene manual editing + re-render; what was missing is natural-language, whole-video revision.

**Scope (user-chosen via AskUserQuestion):** review-first (no auto re-render) + keep script version history.

**Built:**
- **`reviseVideoScript(current, feedback, ctx)`** in `video-script.ts` — feeds the current script + feedback to the model and returns a revised `VideoScript`, preserving language/dialect/style and scene count (unless the feedback says otherwise). Strips render artifacts (asset URLs) so a revised script re-films cleanly.
- **`refineVideoScript(formData)`** action — snapshots the current script to the new `video_script_history` table (with the feedback), revises, saves the new script, and redirects back with a "review then re-render" banner. **Does not auto-render** — the user reviews the new scenes and hits the existing Re-render button (saves credits).
- **`restoreVideoScriptVersion(formData)`** action — snapshots the current script first (symmetric/reversible), then swaps in a chosen past version.
- **`video_script_history`** table (`scripts/add-video-script-history-table.ts`, mirrors `brand_profile_history`): videoProjectId/orgId/snapshot(jsonb)/feedback/createdAt, indexed by (project, createdAt desc).
- **Video editor** (`videos/[id]/page.tsx`): a "Refine with feedback" box (works for avatar + scene styles), a "Script history" panel with Restore buttons, and info/error banners via searchParams.

**Design note — why NOT the text model (immutable new-row chain):** a video project is heavy (rendered assets, finalUrl) and re-rendering costs real money, so duplicating a whole project per refine would double render cost. Video refines the script *in place* on one project and snapshots the prior script for reversibility — consistent with the existing in-place scene editor and with brand-profile version history.

**Verified:** `tsc` + `eslint` clean. Live spike (8/8) against real Claude + hosted Supabase — `reviseVideoScript` applied "make the hook mention it's handmade + add urgency, keep 2 scenes" correctly (produced "Wait, you NEED this handmade coffee mug before they're gone.", 2 scenes preserved); `video_script_history` snapshot + restore round-trip and ON DELETE CASCADE all confirmed. The authenticated editor render is behind the login wall (not driven headless); the actual re-render can't run until the fal balance is topped up (known billing block), but the render pipeline is unchanged — refine only rewrites the script it consumes.
