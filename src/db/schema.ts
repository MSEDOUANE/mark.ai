import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  unique,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * MarkAI data model — SaaS-ready, single-tenant for now.
 *
 * Every tenant-scoped table carries `org_id` so Supabase Row-Level Security
 * can be switched on for multi-tenancy later with no reshaping. For the
 * own-use phase we simply seed and use a single organization.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const platformEnum = pgEnum("platform", ["meta", "tiktok"]);
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
]);
export const adAccountStatusEnum = pgEnum("ad_account_status", [
  "connected",
  "disconnected",
  "error",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "pending_approval",
  "active",
  "paused",
  "completed",
  "failed",
]);
export const creativeTypeEnum = pgEnum("creative_type", ["image", "video"]);
export const creativeStatusEnum = pgEnum("creative_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const actorEnum = pgEnum("actor", ["ai", "user"]);
export const autonomyLevelEnum = pgEnum("autonomy_level", [
  "approve_all",
  "approve_spend",
  "full_auto",
]);
export const entityLevelEnum = pgEnum("entity_level", ["adset", "ad"]);

// ---------------------------------------------------------------------------
// Core tenancy
// ---------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // How autonomous the AI Manager is: gate everything / gate only spend / none.
  autonomyLevel: autonomyLevelEnum("autonomy_level")
    .notNull()
    .default("approve_spend"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const profiles = pgTable("profiles", {
  // Equals auth.users.id (Supabase-managed). Not a Drizzle-managed FK so we
  // never try to migrate the Supabase auth schema.
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  defaultOrgId: uuid("default_org_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("memberships_user_org_unique").on(t.userId, t.orgId)],
);

/**
 * Team invites — the app is currently single-tenant (ensureProfile bridges
 * every new user into the one org as "owner"), so accepting an invite works
 * by ensuring a membership exists via the normal auth bridge, then updating
 * its role to what was invited. `token` is the unguessable accept-link id.
 */
export const pendingInvites = pgTable("pending_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: membershipRoleEnum("role").notNull().default("member"),
  invitedBy: uuid("invited_by").references(() => profiles.id, { onDelete: "set null" }),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "revoked"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Marketing domain
// ---------------------------------------------------------------------------
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Catalog products belong to a brand and are reusable across generations.
  // Legacy per-generation products leave this null, so they never surface in a
  // brand's product catalog.
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  targetAudience: text("target_audience"),
  assets: jsonb("assets").notNull().default(sql`'[]'::jsonb`),
  // Brand kit for designed ad creatives: { logoUrl, primaryColor, accentColor }.
  brand: jsonb("brand"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Soft delete — lets the products list show an "Undo" affordance right
  // after deleting instead of destroying the row immediately. NULL = active.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    // Encrypted at rest with ENCRYPTION_KEY — never store raw tokens.
    encryptedToken: text("encrypted_token"),
    status: adAccountStatusEnum("status").notNull().default("connected"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("ad_accounts_org_platform_external_unique").on(
      t.orgId,
      t.platform,
      t.externalId,
    ),
  ],
);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  adAccountId: uuid("ad_account_id").references(() => adAccounts.id, {
    onDelete: "set null",
  }),
  platform: platformEnum("platform").notNull(),
  name: text("name").notNull(),
  objective: text("objective"),
  // Raw user brief (BriefInput), agent market research (MarketResearch), and
  // AI-generated strategy (Strategy) as JSON.
  brief: jsonb("brief"),
  research: jsonb("research"),
  strategy: jsonb("strategy"),
  status: campaignStatusEnum("status").notNull().default("draft"),
  // Money stored in minor units (e.g. centimes) to avoid float drift.
  budgetMinor: integer("budget_minor"),
  currency: text("currency").notNull().default("MAD"),
  externalIds: jsonb("external_ids").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const creatives = pgTable("creatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  type: creativeTypeEnum("type").notNull(),
  provider: text("provider").notNull().default("higgsfield"),
  providerJobId: text("provider_job_id"),
  status: creativeStatusEnum("status").notNull().default("pending"),
  assetUrl: text("asset_url"),
  prompt: text("prompt"),
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Brand profiles (reusable identity kits across creatives)
// ---------------------------------------------------------------------------
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  primaryColor: text("primary_color"),
  logoUrl: text("logo_url"),          // https URL or base64 data: URL
  websiteUrl: text("website_url"),
  tone: text("tone"),
  description: text("description"),
  // Brand Kit v2 — secondary/accent palette, a display font for rendered
  // creatives, a reusable asset gallery, a default template, and AI-drafted
  // voice notes (from Brand Learning) layered on top of `tone`.
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  fontFamily: text("font_family"),    // Google Fonts family name, e.g. "Poppins"
  assets: jsonb("assets").notNull().default(sql`'[]'::jsonb`), // BrandAsset[]
  defaultTemplate: text("default_template"), // "overlay" | "split" | "bold"
  voiceNotes: text("voice_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Soft delete — lets the brands list show an "Undo" affordance right
  // after deleting instead of destroying the row immediately. NULL = active.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Version history for brand profile edits — brand edits (colors, tone, voice
 * notes, logo, ...) overwrite the row in place with no way to see or recover
 * a prior version. Each row is a full snapshot of the editable fields taken
 * right before an update is applied, so "restore" is a simple field-spread
 * back onto brand_profiles (and itself snapshots the current state first,
 * so restoring is symmetric/reversible too).
 */
export const brandProfileHistory = pgTable("brand_profile_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandProfileId: uuid("brand_profile_id")
    .notNull()
    .references(() => brandProfiles.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // BrandProfileSnapshot JSON: { name, primaryColor, logoUrl, websiteUrl,
  // tone, description, secondaryColor, accentColor, fontFamily, assets,
  // defaultTemplate, voiceNotes }.
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Human-in-the-loop + observability
// ---------------------------------------------------------------------------
export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // e.g. "campaign_launch" | "optimization" — what is being approved.
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  approvedBy: uuid("approved_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const metricsSnapshots = pgTable(
  "metrics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    spendMinor: integer("spend_minor").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    linkClicks: integer("link_clicks").notNull().default(0),
    conversionValueMinor: integer("conversion_value_minor").notNull().default(0),
    raw: jsonb("raw").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("metrics_campaign_date_unique").on(t.campaignId, t.date)],
);

/**
 * Per-ad-set and per-ad daily metrics — the building blocks for entity-level
 * trends over time. Keyed by the platform's external id so re-syncs upsert.
 */
export const entityMetrics = pgTable(
  "entity_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    level: entityLevelEnum("level").notNull(),
    // Platform ids (Meta ad set / ad id). parentExternalId is the ad set id for ads.
    externalId: text("external_id").notNull(),
    parentExternalId: text("parent_external_id"),
    name: text("name"),
    date: date("date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    spendMinor: integer("spend_minor").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    linkClicks: integer("link_clicks").notNull().default(0),
    conversionValueMinor: integer("conversion_value_minor").notNull().default(0),
    raw: jsonb("raw").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("entity_metrics_unique").on(
      t.campaignId,
      t.level,
      t.externalId,
      t.date,
    ),
  ],
);

/**
 * Outputs of the standalone Generate tools (ad copy, social captions,
 * personas) — persisted so they're reusable assets the agent can draw on,
 * not throwaway screen results. input/output are the tool's own JSON shapes.
 */
export const generations = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(), // "ad-copy" | "social-captions" | "personas"
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  input: jsonb("input").notNull().default(sql`'{}'::jsonb`),
  output: jsonb("output").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * AI-written periodic performance reports (weekly cron): what happened, what
 * the agent did, and what it recommends next. payload = ReportPayload JSON.
 */
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Anomaly alerts raised by rule-based checks after each metrics sync —
 * immediate "something is wrong" signals (spend spike, CTR collapse, delivery
 * stop, conversion stop), separate from the optimizer's slower proposals.
 * One OPEN alert per campaign+type at a time; dismissing closes it.
 */
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  // "spend_spike" | "ctr_collapse" | "delivery_stop" | "conversion_stop"
  type: text("type").notNull(),
  severity: text("severity").notNull().default("warning"), // "warning" | "critical"
  message: text("message").notNull(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("open"), // "open" | "dismissed"
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * AI-generated landing pages — the ad-click destination. Content is a
 * structured LandingContent JSON rendered through the fixed branded template
 * at public /p/[slug]; the AI never emits raw HTML.
 */
export const landingPages = pgTable("landing_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** LandingContent JSON (hero, benefits, offer, FAQ, CTA). */
  content: jsonb("content").notNull().default(sql`'{}'::jsonb`),
  /** Visual kit snapshot: { primaryColor, accentColor, logoUrl, photoUrl }. */
  brand: jsonb("brand").notNull().default(sql`'{}'::jsonb`),
  /** Where the CTA points: a URL or a wa.me link. */
  ctaHref: text("cta_href").notNull(),
  /** Content language ("ar" | "en" | "fr") — drives dir="rtl" on the public page. */
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Video Studio projects — multi-scene, voiced video ads. `script` holds the
 * whole editable project (VideoScript JSON: scenes with visual prompts,
 * voiceover lines, and per-scene asset URLs); `finalUrl` is the assembled mp4.
 * Users adjust scenes in the editor and re-render; status tracks the pipeline.
 */
export const videoProjects = pgTable("video_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  // "ugc" | "storytelling" | "showcase"
  style: text("style").notNull().default("ugc"),
  // BCP-47-ish language for voiceover: "en" | "fr" | "ar"
  language: text("language").notNull().default("en"),
  // Arabic dialect id (darija | msa | egyptian | gulf | levantine) — only
  // meaningful when language = "ar". Drives how the script is written.
  dialect: text("dialect"),
  voice: text("voice").notNull().default("female"),
  // VEED avatar id — used by the "avatar" style (lip-synced UGC creator).
  avatar: text("avatar"),
  // User's own avatar photo (data URI or URL). When set on an "avatar" style
  // project, the custom-avatar path (Kling AI Avatar) renders it instead of
  // a VEED preset.
  avatarImageUrl: text("avatar_image_url"),
  // Optional background-music description (e.g. "upbeat lo-fi, warm"). When
  // set, the render pipeline generates a music bed and layers it under the
  // final cut alongside the voiceover.
  musicPrompt: text("music_prompt"),
  // "draft" | "rendering" | "ready" | "failed"
  status: text("status").notNull().default("draft"),
  script: jsonb("script").notNull().default(sql`'{}'::jsonb`),
  finalUrl: text("final_url"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * WhatsApp lead conversations (from click-to-WhatsApp ads or organic inbound)
 * via the WhatsApp Business Cloud API webhook. One row per message; the AI
 * responder threads by contact number.
 */
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** Contact phone in E.164 without "+", as Meta sends it (e.g. "2126…"). */
  contact: text("contact").notNull(),
  contactName: text("contact_name"),
  direction: text("direction").notNull(), // "in" | "out"
  body: text("body").notNull(),
  /** Meta message id — for idempotent webhook processing. */
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Every spend/launch action, by AI or human — for trust and debugging. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  actor: actorEnum("actor").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  costMinor: integer("cost_minor"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Organic content queue — posts the user has planned/scheduled to publish to a
 * connected Meta Page. A cron processor (publish-scheduled) picks up rows whose
 * `scheduledFor` is due and `status` = "scheduled", publishes them via the
 * organic-publish path, and advances status. `imageUrl` is an absolute image
 * URL (or a creative can be referenced via `creativeId`, rendered on publish).
 * status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "canceled".
 */
export const scheduledPosts = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
    onDelete: "set null",
  }),
  creativeId: uuid("creative_id").references(() => creatives.id, {
    onDelete: "set null",
  }),
  caption: text("caption").notNull(),
  /** Absolute image URL to post. When null, a linked creative is rendered at publish time. */
  imageUrl: text("image_url"),
  platform: text("platform").notNull().default("meta_page"),
  status: text("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  postId: text("post_id"),
  permalink: text("permalink"),
  error: text("error"),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Library organization metadata — favorites + folders for the unified Asset
 * Library, which spans 4 heterogeneous tables (creatives, generations,
 * video_projects, landing_pages) with no shared schema. Rather than add
 * favorite/folder columns to each, one row here keyed by (org, kind, item_id)
 * covers all of them; the Library page joins it in-memory against whichever
 * table `kind` points to. kind: "image" | "video" | "text" | "page" (mirrors
 * the Library's existing AssetItem.kind).
 */
export const libraryItemMeta = pgTable(
  "library_item_meta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    itemId: uuid("item_id").notNull(),
    favorite: boolean("favorite").notNull().default(false),
    folder: text("folder"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique().on(table.orgId, table.kind, table.itemId)],
);
