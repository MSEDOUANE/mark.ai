# MarkAI — Test Scenarios (low-cost)

These exercise the app's real flows **without spending paid API credits**. The
generation happy-paths (Claude strategy, Higgsfield creative, live Meta launch)
are integration-verified separately and are credit/approval-gated, so they're
listed under §F but excluded from the low-cost run.

Load fixtures first: `npm run db:seed:test` (creates "TEST —" campaigns with a
canned strategy, ready creatives, metrics, and a pending recommendation).

App: http://localhost:3001 · Test account: `founder@markai.local` / `password123`

## A. Auth & access control
- **A1** Visit `/dashboard` logged out → redirected to `/login`.
- **A2** Sign up a fresh account → lands on `/dashboard` showing the org name.
- **A3** Sign out → `/login`; revisiting `/dashboard` redirects to `/login`.
- **A4** Log in as the test account → `/dashboard`.

## B. Navigation & empty states
- **B1** Dashboard → "View campaigns" → campaign list renders.
- **B2** Dashboard → "Settings" → ad-account section renders.

## C. Ad account connect (free — verifies token encryption at rest)
- **C1** Settings → connect Meta account (id `100000000000000`, token `TEST_TOKEN`) → appears as `meta · 100000000000000 · connected`.
- **C2** Disconnect → removed from the list.

## D. Launch approval gate (seeded draft campaign — no paid calls)
- **D1** Open "TEST — Draft campaign" → shows Strategy + 2 ready creatives + a Launch section.
- **D2** Prepare launch (pick the connected account) → status `pending_approval`; approval card shows objective + daily budget.
- **D3** Reject → status back to `draft`.
- **D4** Prepare again → Approve → Meta call fails on the fake token → status `failed` + Activity logs `campaign_launch_failed` (proves the gate + graceful error handling).

## E. Optimization loop (seeded active campaign + metrics + recommendation)
- **E1** Open "TEST — Active campaign" → Performance table lists the seeded daily metrics.
- **E2** Optimization card shows the seeded recommendation (`scale_up`) → Approve → budget updated, Activity logs `optimization_scale_up`.
- **E3** (alt) Reject a recommendation → removed, campaign stays active.

## F. Credit-gated (NOT part of the low-cost run — verified at integration level)
- **F1** New brief → real Claude strategy (needs Anthropic credits).
- **F2** Creative generation → real Higgsfield (needs balance + `npx inngest-cli dev`).
- **F3** Real Meta launch (needs a valid sandbox token + Business Verification).
