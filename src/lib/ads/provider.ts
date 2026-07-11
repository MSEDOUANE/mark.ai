/**
 * Ad-platform provider interface, shared by Meta and TikTok.
 *
 * Spend-affecting methods (`launch`, `pause`) are only ever called *after* a
 * human approval has been recorded — the orchestration layer enforces that, not
 * the provider. Access tokens are passed in (decrypted just-in-time from
 * `ad_accounts.encrypted_token`), never stored on the provider.
 */

export type AdPlatform = "meta" | "tiktok";

export interface CampaignSpec {
  name: string;
  objective: string;
  /** Daily budget in minor currency units (e.g. centimes). */
  dailyBudgetMinor: number;
  currency: string;
  /** Targeting, placements, creative references — expanded later. */
  raw?: Record<string, unknown>;
}

export interface AdAccountCredentials {
  /** Platform ad account id (e.g. a Meta act id without the "act_" prefix). */
  externalId: string;
  accessToken: string;
}

export interface LaunchResult {
  externalCampaignId: string;
  raw?: Record<string, unknown>;
}

/** A Facebook Page available to the connected user (required for ad creatives). */
export interface MetaPage {
  id: string;
  name: string;
}

/** One creative variant (image + copy) to ship as an ad. */
export interface LaunchCreativeInput {
  headline: string;
  primaryText: string;
  /** Human CTA label (e.g. "Shop Now"); mapped to the platform CTA enum. */
  callToAction: string;
  /** Destination URL the ad clicks through to. */
  link: string;
  /** Designed creative rendered to PNG bytes (uploaded to the platform). */
  imageBytes: Uint8Array;
  imageName: string;
  /** Caller's identifier (our creative row id) echoed back in the result. */
  refId?: string;
}

/**
 * Everything needed to stand up a *complete, deliverable* campaign on the
 * platform — campaign → ad set (budget/targeting/optimization) → ad image →
 * ad creative (page + link + copy) → ad. Everything is created PAUSED.
 */
export interface FullLaunchPlan {
  campaignName: string;
  objective: string;
  /** Daily budget in minor currency units. */
  dailyBudgetMinor: number;
  /** ISO-3166 alpha-2 country codes to target. */
  countries: string[];
  ageMin?: number;
  ageMax?: number;
  /** Facebook Page the ad is published from. */
  pageId: string;
  /**
   * Where a click lands: the website (default) or a WhatsApp chat with the
   * Page's connected WhatsApp Business number (click-to-WhatsApp ad).
   */
  destination?: "website" | "whatsapp";
  /**
   * Creative variants to ship — one ad per entry, all inside the single ad
   * set. Two or more = an A/B test the winner-detection loop can resolve.
   */
  creatives: LaunchCreativeInput[];
}

/** One shipped ad (variant) inside the launched tree. */
export interface LaunchedAd {
  adId: string;
  creativeId: string;
  /** Echo of LaunchCreativeInput.refId (our creative row id). */
  refId?: string;
}

export interface FullLaunchResult {
  externalCampaignId: string;
  externalAdSetId: string;
  /** First variant's ids — kept for single-creative callers/back-compat. */
  externalCreativeId: string;
  externalAdId: string;
  /** All shipped variants, in plan order. */
  ads: LaunchedAd[];
  raw?: Record<string, unknown>;
}

export interface InsightsQuery {
  externalCampaignId: string;
  /** ISO date (inclusive). */
  since: string;
  /** ISO date (inclusive). */
  until: string;
}

export interface CampaignInsights {
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  /** Spend in minor currency units. */
  spendMinor: number;
  conversions: number;
  /** Conversion (purchase) value in minor units — for ROAS. */
  conversionValueMinor: number;
  raw?: Record<string, unknown>;
}

/** An existing campaign discovered on the ad account (for importing). */
export interface ImportedCampaign {
  externalId: string;
  name: string;
  objective: string;
  status: "active" | "paused";
  /** Campaign-level (CBO) daily budget in minor units, if set. */
  campaignDailyBudgetMinor: number | null;
  /** Primary ad-set id (budget usually lives here, not at campaign level). */
  primaryAdSetId: string | null;
  /** Primary ad-set daily budget in minor units. */
  primaryAdSetBudgetMinor: number | null;
}

/** A campaign's ad set — where budget actually lives in most accounts. */
export interface AdSetInfo {
  id: string;
  dailyBudgetMinor: number | null;
}

/** Aggregated KPIs for one entity (ad set or ad) over the queried window. */
export interface EntityKpis {
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  /** Spend in minor currency units. */
  spendMinor: number;
  conversions: number;
  conversionValueMinor: number;
}

/** An ad set within a campaign, with its KPIs over the queried window. */
export interface AdSetBreakdown {
  id: string;
  name: string;
  /** Platform status, e.g. ACTIVE / PAUSED. */
  status: string;
  dailyBudgetMinor: number | null;
  optimizationGoal: string | null;
  kpis: EntityKpis;
}

/** An ad within a campaign, with its KPIs over the queried window. */
export interface AdBreakdown {
  id: string;
  name: string;
  status: string;
  /** Parent ad-set id, for grouping. */
  adSetId: string | null;
  kpis: EntityKpis;
}

/** The full ad-set + ad hierarchy of a campaign, each with KPIs. */
export interface CampaignBreakdown {
  adSets: AdSetBreakdown[];
  ads: AdBreakdown[];
}

/** One day's metrics for a single ad set or ad (for entity-level trends). */
export interface EntityDailyInsight {
  level: "adset" | "ad";
  externalId: string;
  /** Parent ad-set id for ads; null for ad sets. */
  parentExternalId: string | null;
  name: string | null;
  date: string; // YYYY-MM-DD
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  spendMinor: number;
  conversions: number;
  conversionValueMinor: number;
  raw?: Record<string, unknown>;
}

/** One day's metrics from a platform insights breakdown. */
export interface DailyInsight {
  date: string; // YYYY-MM-DD
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  spendMinor: number;
  conversions: number;
  conversionValueMinor: number;
  /** Full raw insights row from the platform (captures everything else). */
  raw?: Record<string, unknown>;
}

export interface CampaignProvider {
  readonly platform: AdPlatform;
  /** Create a campaign shell (no ad sets/ads). Call only after human approval. */
  launch(
    spec: CampaignSpec,
    account: AdAccountCredentials,
  ): Promise<LaunchResult>;
  /**
   * Stand up the full, deliverable campaign tree (campaign → ad set → image →
   * creative → ad), all PAUSED. Call only after human approval.
   */
  launchFull(
    plan: FullLaunchPlan,
    account: AdAccountCredentials,
  ): Promise<FullLaunchResult>;
  /** List Facebook Pages available to the connected user (for ad creatives). */
  listPages(accessToken: string): Promise<MetaPage[]>;
  /** Pull aggregated performance insights for an existing campaign. */
  getInsights(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<CampaignInsights>;
  /** Pause a running campaign. */
  pause(externalCampaignId: string, accessToken: string): Promise<void>;

  // --- importing + applying real changes to existing campaigns ---
  /** List existing campaigns on the ad account, for importing. */
  listCampaigns(account: AdAccountCredentials): Promise<ImportedCampaign[]>;
  /** Get a campaign's primary ad set (id + current daily budget). */
  getPrimaryAdSet(
    externalCampaignId: string,
    accessToken: string,
  ): Promise<AdSetInfo | null>;
  /** Get a specific ad set by id (id + current daily budget). */
  getAdSet(adSetId: string, accessToken: string): Promise<AdSetInfo | null>;
  /** Update an ad set's daily budget (minor units) — applies a scale action. */
  updateAdSetBudget(
    adSetId: string,
    dailyBudgetMinor: number,
    accessToken: string,
  ): Promise<void>;
  /** Per-day insights over a date range (for metrics snapshots). */
  getDailyInsights(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<DailyInsight[]>;
  /**
   * Fetch daily insights for ALL campaigns on an account in a single API call.
   * Returns a map of externalCampaignId → DailyInsight[]. Used by bulk import
   * to avoid one-call-per-campaign fan-out.
   */
  getAccountDailyInsightsBatch(
    account: AdAccountCredentials,
    since: string,
    until: string,
  ): Promise<Map<string, DailyInsight[]>>;
  /** Full ad-set + ad hierarchy with per-entity KPIs over a date range. */
  getCampaignBreakdown(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<CampaignBreakdown>;
  /** Per-day insights for every ad set OR every ad (entity-level trends). */
  getEntityDailyInsights(
    query: InsightsQuery,
    level: "adset" | "ad",
    accessToken: string,
  ): Promise<EntityDailyInsight[]>;
}
