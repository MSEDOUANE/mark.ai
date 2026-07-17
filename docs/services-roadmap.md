# MarkAI — Agentic Marketing Service Catalog

The complete service surface an agentic marketing system should provide, mapped
against what exists today. The agent owns the loop — research → strategy →
creative → launch → monitor → optimize → report — with humans approving spend.

Status: ✅ built & verified · 🔶 partial · ❌ not built

---

## 1. Research & Intelligence

| Service | Status | Notes |
|---|---|---|
| Market research (web-grounded) | ✅ | Step 0 of every campaign; real stats + sources |
| Competitor identification | ✅ | Part of research (found real competitors live) |
| Audience personas | ✅ | Standalone tool, brand-aware, persisted |
| **Competitor ad monitoring** | 🔶 | Ad Library client + assistant tool built ("what is X running in FR?"); activates after one-time identity confirmation at facebook.com/ads/library/api (EU countries only for commercial ads) |
| **Trend & seasonality detection** | ✅ | Marketing Calendar tool (/dashboard/generate/calendar) — date-anchored, weights Islamic-calendar moments for MENA |
| Keyword / search intent research | ❌ | Only matters if/when Google Ads channel is added |

## 2. Strategy & Planning

| Service | Status | Notes |
|---|---|---|
| Campaign strategy from a brief | ✅ | Brand-voice-grounded, research-grounded |
| Channel recommendation | 🔶 | Strategist picks meta/tiktok; only Meta is executable |
| Budget parsing + currency safety | ✅ | Auto-converts stated currency to account billing currency |
| **Cross-campaign budget allocation** | ✅ | AI media buyer: weekly cron (+ assistant tool) proposes redistributing the total daily budget by 14-day performance; org-level approval card on Overview; approval pushes real ad-set budgets |
| **Marketing calendar** | ✅ | /dashboard/generate/calendar — prioritized 3/6/12-month calendar of seasonal/religious/retail moments per product |
| Funnel design (TOFU/MOFU/BOFU) | ✅ | /dashboard/generate/funnel — 3-stage journey with per-stage angles/formats/hooks + Morocco COD playbook |

## 3. Brand Management

| Service | Status | Notes |
|---|---|---|
| Brand profiles (logo/colors/tone/voice) | ✅ | Single catalog feeding agent + all tools |
| Website brand import | ✅ | Scan URL → name/colors/logo/tone |
| Product catalog (brand-scoped, reusable) | ✅ | Auto-grows from briefs and wizard use |
| Brand-safety check on generated content | ✅ | /dashboard/generate/brand-safety — 0-100 score + pass/review/fail, flags off-voice/claims/policy/cultural issues |

## 4. Creative & Content Production

| Service | Status | Notes |
|---|---|---|
| Designed ad creatives (4 sizes, templates) | ✅ | next/og compositor; usable without image credits |
| AI backgrounds (text2img / img2img) | ✅ | nano-banana-2, FLUX Schnell/Redux |
| AI Compose (product + model blend) | ✅ | Multi-reference nano-banana-edit |
| Ad copy (frameworks) | ✅ | Brand-aware, persisted |
| Social captions (per-platform) | ✅ | Brand-aware, persisted |
| Conversion scoring + refine loop | ✅ | Score → tips → AI rewrite to 90+ |
| **Video ads** | ✅ | Two layers, all on fal.ai: (1) "Animate" turns any image creative into a 5s Kling clip; (2) **Video Studio** (/dashboard/videos) — UGC/storytelling/showcase styles, AI scene-by-scene script, per-scene image→video, Kokoro TTS voiceover (EN/FR), ffmpeg assembly, and a scene editor (edit visuals/motion/voiceover/length, reorder, delete, regenerate scene, re-render); plus **UGC Avatar** style — lip-synced talking creator (VEED avatars: Emily/Marcus/Mira/Elena/Jasmine/Aisha) speaking the script in one take |
| **Landing pages** | ✅ | AI writes structured content in brand voice → fixed branded template at public /p/[slug]; Pages section in dashboard; CTA = WhatsApp (wa.me) or link |
| Email marketing content | ✅ | /dashboard/generate/email — single emails + sequences (welcome/cart/launch/win-back) with A/B subjects. Content only; sending/ESP integration not built |
| Organic content calendar + scheduling | ✅ | /dashboard/generate/scheduler — Claude content planner + scheduled queue + Inngest processor that auto-publishes due posts to a connected Meta Page (skips gracefully when no Page connected) |

## 5. Campaign Execution

| Service | Status | Notes |
|---|---|---|
| Meta launch (full paused tree) | ✅ | campaign → ad set → creative → ad, approval-gated |
| Publish standalone creative as ad | ✅ | One creative → wrapped campaign → same gate |
| Campaign import from Meta | ✅ | Existing campaigns + history |
| Autonomy levels (approve_all/spend/full_auto) | ✅ | Single audited spend path |
| **TikTok Ads** | ❌ | Phase 4; API approval takes weeks — start early |
| Google Ads | ❌ | Later channel |
| **A/B test orchestration** | ✅ | Top-3 scored creatives launch as ads in one ad set; rule-based winner check pauses losers (autonomy-gated) |
| Retargeting audiences (Pixel/custom audiences) | ❌ | Needs Pixel install; unlocks conversion optimization on Meta |

## 6. Monitoring & Optimization

| Service | Status | Notes |
|---|---|---|
| Daily metrics sync (campaign/ad set/ad) | ✅ | Cron + on-demand, per-entity trends |
| AI optimizer (keep/scale/pause/kill) | ✅ | Range-aware, approval-gated when spend increases |
| Creative refresh on fatigue | ✅ | Agent proposes fresh variants, spend-neutral |
| Optimization chat (per campaign) | ✅ | Ongoing thread + approval gate + change preview |
| **Anomaly alerts** | ✅ | Rule-based: spend spike, CTR collapse, delivery stop, conversion stop → Overview banners, deduped, audit-logged |
| Cross-campaign reallocation | ✅ | See §2 — executeAllocation applies approved budgets per campaign with per-line audit |

## 7. Reporting & Insights

| Service | Status | Notes |
|---|---|---|
| Weekly AI report | ✅ | Cron Monday + on-demand; Overview card |
| Campaign analytics (KPIs, trends, breakdown) | ✅ | Date-range-aware charts + tables |
| **Report delivery (email)** | ✅ | Weekly digest + critical anomaly alerts via Resend (env-gated: set RESEND_API_KEY); WhatsApp delivery deferred to the WhatsApp channel work |
| Attribution & ROAS by conversion value | 🔶 | Fields synced; real attribution needs Pixel + conversions API |
| LTV / cohort analysis | ❌ | SaaS-phase feature |

## 8. Agent Interface

| Service | Status | Notes |
|---|---|---|
| Per-campaign optimization chat | ✅ | |
| **Global marketing assistant** | ✅ | `/dashboard/assistant` — Claude with 7 org-scoped capability tools (overview, performance, catalog, create campaign, refresh creatives, optimizer, report); persisted thread; spend stays approval-gated |
| Approval inbox | ✅ | /dashboard/approvals — one queue for launch/optimization/allocation approvals with inline approve/reject; sidebar count badge |

## 9. Morocco-market differentiators (SaaS wedge)

| Service | Status | Notes |
|---|---|---|
| **WhatsApp follow-up / lead handling** | 🔶 | Click-to-WhatsApp launches ✅ (destination toggle on brief → WHATSAPP ad set + CTA); AI lead responder scaffold ✅ (webhook + message store + brand-voice auto-reply) — activates once WHATSAPP_TOKEN/PHONE_NUMBER_ID are set and the Page has a WA Business number |
| Darija/FR/AR content generation | ✅ | Shared LanguagePicker (default Arabic/Darija) across every text tool + campaign strategist; creative images render Arabic correctly (Cairo fallback font). UI-chrome translation/RTL still deferred |
| Local payments (CMI/PayZone billing) | ❌ | Phase 5 SaaS |
| COD-friendly funnel patterns | 🔶 | Guidance built into the Funnel Designer's local playbook (COD trust, WhatsApp follow-up, cart recovery); actual COD checkout flow not built |

---

## Suggested build order (value ÷ effort)

1. **Anomaly alerts** — small (extends metrics cron), protects real money daily
2. **A/B test orchestration** — creatives + scoring + budget tools all exist; this connects them
3. **Global marketing assistant chat** — wraps existing capabilities as agent tools; the product's "front door"
4. **Report delivery via email/WhatsApp** — reporting exists, just needs a channel
5. **Click-to-WhatsApp campaigns + AI lead responder** — Morocco differentiator
6. **Landing page generator** — closes the click loop
7. **Competitor ad monitoring (Meta Ad Library)** — feeds strategy + creative refresh
8. **Cross-campaign budget allocation** — the full "media buyer" replacement
9. **TikTok** (Phase 4 — start API approval process early, it takes weeks)
10. **Video ads** — when Higgsfield/fal video is funded
