import type {
  AdAccountCredentials,
  AdSetInfo,
  CampaignBreakdown,
  CampaignInsights,
  CampaignProvider,
  CampaignSpec,
  DailyInsight,
  EntityDailyInsight,
  EntityKpis,
  FullLaunchPlan,
  FullLaunchResult,
  ImportedCampaign,
  InsightsQuery,
  LaunchCreativeInput,
  LaunchedAd,
  LaunchResult,
  MetaPage,
} from "./provider";

const GRAPH_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Map a free-text campaign objective to a Meta ODAX objective. */
function mapObjective(objective: string): string {
  const o = objective.toLowerCase();
  if (/(sale|purchase|conversion|buy|revenue|ecommerce|shop)/.test(o))
    return "OUTCOME_SALES";
  if (/(lead|sign[\s-]?up|subscribe|register)/.test(o)) return "OUTCOME_LEADS";
  if (/(install|\bapp\b)/.test(o)) return "OUTCOME_APP_PROMOTION";
  if (/(engage|engagement|like|follow|comment|message)/.test(o))
    return "OUTCOME_ENGAGEMENT";
  if (/(aware|awareness|reach|brand|impression)/.test(o))
    return "OUTCOME_AWARENESS";
  return "OUTCOME_TRAFFIC";
}

/**
 * Pick an ad-set optimization goal that's valid for the objective *without*
 * requiring a Pixel/promoted_object. Conversion optimization (OFFSITE_CONVERSIONS)
 * needs a connected Pixel + events, which we don't wire up yet — so we optimize
 * for the best no-Pixel proxy (link clicks / reach / engagement). billing_event
 * is always IMPRESSIONS, which every goal here accepts.
 */
function optimizationForObjective(metaObjective: string): {
  optimizationGoal: string;
  billingEvent: string;
} {
  const goal =
    metaObjective === "OUTCOME_AWARENESS"
      ? "REACH"
      : metaObjective === "OUTCOME_ENGAGEMENT"
        ? "POST_ENGAGEMENT"
        : // TRAFFIC / SALES / LEADS / APP_PROMOTION → drive clicks to the site.
          "LINK_CLICKS";
  return { optimizationGoal: goal, billingEvent: "IMPRESSIONS" };
}

/** Map a free-text CTA label to a Meta call_to_action enum. */
function mapCallToAction(label: string | null | undefined): string {
  const c = (label ?? "").toLowerCase();
  if (/(shop|buy|order|purchase|cart)/.test(c)) return "SHOP_NOW";
  if (/(sign\s?up|register|join|create account)/.test(c)) return "SIGN_UP";
  if (/(subscribe)/.test(c)) return "SUBSCRIBE";
  if (/(download|install|get the app)/.test(c)) return "DOWNLOAD";
  if (/(book)/.test(c)) return "BOOK_TRAVEL";
  if (/(contact|message|chat)/.test(c)) return "CONTACT_US";
  if (/(quote)/.test(c)) return "GET_QUOTE";
  if (/(apply)/.test(c)) return "APPLY_NOW";
  if (/(offer|deal|discount|sale)/.test(c)) return "GET_OFFER";
  return "LEARN_MORE";
}

/** Follow `paging.next` cursors to collect all insight rows across pages. */
async function graphPaged(
  startUrl: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let next: string | null = startUrl;
  for (let page = 0; page < 40 && next; page++) {
    const data: {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
    } = await graph(next);
    rows.push(...(data.data ?? []));
    next = data.paging?.next ?? null;
  }
  return rows;
}

const RATE_LIMIT_CODE = 17;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000]; // 3 retries: 2s → 5s → 15s

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(url, init);
    const json: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      const e = (
        json as {
          error?: {
            message?: string;
            error_user_title?: string;
            error_user_msg?: string;
            code?: number;
            error_subcode?: number;
          };
        }
      ).error;
      const parts = [
        e?.message,
        e?.error_user_title,
        e?.error_user_msg,
        e?.code != null ? `code ${e.code}` : null,
        e?.error_subcode != null ? `subcode ${e.error_subcode}` : null,
      ].filter(Boolean);
      const msg = parts.length > 0 ? parts.join(" — ") : `HTTP ${res.status}`;
      lastError = new Error(`Meta API error: ${msg}`);

      // Rate limit — back off and retry.
      if (e?.code === RATE_LIMIT_CODE && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }

      throw lastError;
    }

    return json as T;
  }

  throw lastError ?? new Error("Meta API: max retries exceeded");
}

function extractConversions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  for (const a of actions) {
    const at = (a as { action_type?: string })?.action_type;
    if (
      typeof at === "string" &&
      /purchase|lead|complete_registration/.test(at)
    ) {
      return Number((a as { value?: unknown }).value ?? 0);
    }
  }
  return 0;
}

function extractConversionValue(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0;
  for (const a of actionValues) {
    const at = (a as { action_type?: string })?.action_type;
    if (typeof at === "string" && /purchase/.test(at)) {
      return Number((a as { value?: unknown }).value ?? 0);
    }
  }
  return 0;
}

// Comprehensive Ads-Manager field set. The full row is also stored in `raw`.
const INSIGHT_FIELDS =
  "impressions,reach,clicks,inline_link_clicks,spend,actions,action_values";

function parseInsightRow(row: Record<string, unknown>) {
  return {
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    clicks: Number(row.clicks ?? 0),
    linkClicks: Number(row.inline_link_clicks ?? 0),
    spendMinor: Math.round(Number(row.spend ?? 0) * 100),
    conversions: extractConversions(row.actions),
    conversionValueMinor: Math.round(
      extractConversionValue(row.action_values) * 100,
    ),
  };
}

/**
 * Meta (Facebook/Instagram) Marketing API provider.
 *
 * Build/test against the Meta sandbox/dev app while Business Verification +
 * App Review (ads_management, ads_read) are in flight. Campaigns are created
 * PAUSED — the human approved the plan, but we never auto-start spend.
 */
export class MetaCampaignProvider implements CampaignProvider {
  readonly platform = "meta" as const;

  async launch(
    spec: CampaignSpec,
    account: AdAccountCredentials,
  ): Promise<LaunchResult> {
    const body = new URLSearchParams({
      name: spec.name,
      objective: mapObjective(spec.objective),
      status: "PAUSED",
      special_ad_categories: JSON.stringify([]),
      // Required when no campaign-level budget is set; false = ad sets don't
      // share budget (we set budgets at the ad-set level later).
      is_adset_budget_sharing_enabled: "false",
      access_token: account.accessToken,
    });
    const data = await graph<{ id: string }>(
      `${GRAPH_BASE}/act_${account.externalId}/campaigns`,
      { method: "POST", body },
    );
    return { externalCampaignId: data.id, raw: { id: data.id } };
  }

  /**
   * Stand up the complete, deliverable campaign tree on Meta — campaign → ad set
   * → uploaded ad image → ad creative → ad — all PAUSED. This is the real launch
   * path: a campaign created via `launch` alone has no ad sets/ads and delivers
   * nothing. Runs the steps sequentially because each id feeds the next.
   */
  async launchFull(
    plan: FullLaunchPlan,
    account: AdAccountCredentials,
  ): Promise<FullLaunchResult> {
    const acct = account.externalId;
    const token = account.accessToken;
    const metaObjective = mapObjective(plan.objective);

    // 1. Campaign shell.
    const { externalCampaignId } = await this.launch(
      {
        name: plan.campaignName,
        objective: plan.objective,
        dailyBudgetMinor: plan.dailyBudgetMinor,
        currency: "",
      },
      account,
    );

    // 2. Ad set: where budget, targeting and optimization live.
    const adSetId = await this.createAdSet(
      acct,
      externalCampaignId,
      metaObjective,
      plan,
      token,
    );

    // 3–5. Per variant: upload image → ad creative → ad. Multiple variants in
    // the one ad set = a split test Meta's delivery optimizes between.
    const ads: LaunchedAd[] = [];
    for (const variant of plan.creatives) {
      const imageHash = await this.uploadAdImage(
        acct,
        variant.imageBytes,
        variant.imageName,
        token,
      );
      const creativeId = await this.createAdCreative(
        acct,
        plan,
        variant,
        imageHash,
        token,
      );
      const adName = (variant.headline || plan.campaignName).slice(0, 80);
      const adId = await this.createAd(acct, adName, adSetId, creativeId, token);
      ads.push({ adId, creativeId, refId: variant.refId });
    }

    return {
      externalCampaignId,
      externalAdSetId: adSetId,
      externalCreativeId: ads[0]?.creativeId ?? "",
      externalAdId: ads[0]?.adId ?? "",
      ads,
    };
  }

  async createAdSet(
    accountId: string,
    campaignId: string,
    metaObjective: string,
    plan: FullLaunchPlan,
    token: string,
  ): Promise<string> {
    const { optimizationGoal, billingEvent } =
      optimizationForObjective(metaObjective);
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: plan.countries },
    };
    if (plan.ageMin) targeting.age_min = plan.ageMin;
    if (plan.ageMax) targeting.age_max = plan.ageMax;

    const isWhatsApp = plan.destination === "whatsapp";
    const body = new URLSearchParams({
      name: `${plan.campaignName} — Ad set`.slice(0, 120),
      campaign_id: campaignId,
      daily_budget: String(plan.dailyBudgetMinor),
      // Click-to-WhatsApp: optimize for started conversations on the Page's
      // connected WhatsApp Business number (Page must have one linked).
      billing_event: isWhatsApp ? "IMPRESSIONS" : billingEvent,
      optimization_goal: isWhatsApp ? "CONVERSATIONS" : optimizationGoal,
      ...(isWhatsApp
        ? {
            destination_type: "WHATSAPP",
            promoted_object: JSON.stringify({ page_id: plan.pageId }),
          }
        : {}),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      status: "PAUSED",
      access_token: token,
    });
    const data = await graph<{ id: string }>(
      `${GRAPH_BASE}/act_${accountId}/adsets`,
      { method: "POST", body },
    );
    return data.id;
  }

  /** Upload raw image bytes to the ad account's image library; returns the hash. */
  async uploadAdImage(
    accountId: string,
    bytes: Uint8Array,
    filename: string,
    token: string,
  ): Promise<string> {
    const form = new FormData();
    // Slice to a concrete ArrayBuffer (Uint8Array's backing buffer is typed as
    // ArrayBufferLike, which the Blob ctor types reject).
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    form.append("source", new Blob([ab], { type: "image/png" }), filename);
    form.append("access_token", token);
    const data = await graph<{
      images?: Record<string, { hash?: string }>;
    }>(`${GRAPH_BASE}/act_${accountId}/adimages`, {
      method: "POST",
      body: form,
    });
    const first = Object.values(data.images ?? {})[0];
    if (!first?.hash) throw new Error("Meta did not return an ad image hash");
    return first.hash;
  }

  async createAdCreative(
    accountId: string,
    plan: FullLaunchPlan,
    variant: LaunchCreativeInput,
    imageHash: string,
    token: string,
  ): Promise<string> {
    const isWhatsApp = plan.destination === "whatsapp";
    const objectStorySpec = {
      page_id: plan.pageId,
      link_data: {
        message: variant.primaryText,
        // CTWA ads click through to the WhatsApp send endpoint; Meta routes
        // to the Page's connected number.
        link: isWhatsApp ? "https://api.whatsapp.com/send" : variant.link,
        name: variant.headline,
        image_hash: imageHash,
        call_to_action: isWhatsApp
          ? { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }
          : {
              type: mapCallToAction(variant.callToAction),
              value: { link: variant.link },
            },
      },
    };
    const body = new URLSearchParams({
      name: `${plan.campaignName} — ${variant.headline}`.slice(0, 120),
      object_story_spec: JSON.stringify(objectStorySpec),
      access_token: token,
    });
    const data = await graph<{ id: string }>(
      `${GRAPH_BASE}/act_${accountId}/adcreatives`,
      { method: "POST", body },
    );
    return data.id;
  }

  async createAd(
    accountId: string,
    name: string,
    adSetId: string,
    creativeId: string,
    token: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      name,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: "PAUSED",
      access_token: token,
    });
    const data = await graph<{ id: string }>(
      `${GRAPH_BASE}/act_${accountId}/ads`,
      { method: "POST", body },
    );
    return data.id;
  }

  async listPages(accessToken: string): Promise<MetaPage[]> {
    const url = new URL(`${GRAPH_BASE}/me/accounts`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", accessToken);
    const data = await graph<{ data?: Array<Record<string, unknown>> }>(
      url.toString(),
    );
    return (data.data ?? [])
      .filter((p) => p.id)
      .map((p) => ({ id: String(p.id), name: String(p.name ?? "Page") }));
  }

  async getInsights(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<CampaignInsights> {
    const url = new URL(`${GRAPH_BASE}/${query.externalCampaignId}/insights`);
    url.searchParams.set("fields", INSIGHT_FIELDS);
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: query.since, until: query.until }),
    );
    url.searchParams.set("access_token", accessToken);

    const data = await graph<{ data?: Array<Record<string, unknown>> }>(
      url.toString(),
    );
    const row = data.data?.[0] ?? {};
    return { ...parseInsightRow(row), raw: row };
  }

  async pause(externalCampaignId: string, accessToken: string): Promise<void> {
    const body = new URLSearchParams({
      status: "PAUSED",
      access_token: accessToken,
    });
    await graph(`${GRAPH_BASE}/${externalCampaignId}`, { method: "POST", body });
  }

  async listCampaigns(
    account: AdAccountCredentials,
  ): Promise<ImportedCampaign[]> {
    const url = new URL(`${GRAPH_BASE}/act_${account.externalId}/campaigns`);
    // Include the first ad set inline so callers don't need a second round-trip.
    url.searchParams.set(
      "fields",
      "id,name,objective,effective_status,daily_budget,adsets.limit(1){id,daily_budget}",
    );
    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", account.accessToken);
    const data = await graph<{ data?: Array<Record<string, unknown>> }>(
      url.toString(),
    );
    return (data.data ?? []).map((c) => {
      const adsetRows =
        (c.adsets as { data?: Array<Record<string, unknown>> } | undefined)
          ?.data ?? [];
      const firstAdSet = adsetRows[0];
      return {
        externalId: String(c.id),
        name: String(c.name ?? "Untitled campaign"),
        objective: String(c.objective ?? ""),
        status: String(c.effective_status ?? "")
          .toUpperCase()
          .includes("PAUSE")
          ? ("paused" as const)
          : ("active" as const),
        campaignDailyBudgetMinor:
          c.daily_budget != null ? Number(c.daily_budget) : null,
        primaryAdSetId: firstAdSet?.id != null ? String(firstAdSet.id) : null,
        primaryAdSetBudgetMinor:
          firstAdSet?.daily_budget != null
            ? Number(firstAdSet.daily_budget)
            : null,
      };
    });
  }

  async getAccountDailyInsightsBatch(
    account: AdAccountCredentials,
    since: string,
    until: string,
  ): Promise<Map<string, DailyInsight[]>> {
    const url = new URL(`${GRAPH_BASE}/act_${account.externalId}/insights`);
    url.searchParams.set("level", "campaign");
    url.searchParams.set("fields", `campaign_id,${INSIGHT_FIELDS}`);
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("limit", "500");
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("access_token", account.accessToken);

    const rows = await graphPaged(url.toString());
    const map = new Map<string, DailyInsight[]>();
    for (const row of rows) {
      const cid = String(row.campaign_id ?? "");
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push({
        date: String(row.date_start ?? since),
        ...parseInsightRow(row),
        raw: row,
      });
    }
    return map;
  }

  async getPrimaryAdSet(
    externalCampaignId: string,
    accessToken: string,
  ): Promise<AdSetInfo | null> {
    const url = new URL(`${GRAPH_BASE}/${externalCampaignId}/adsets`);
    url.searchParams.set("fields", "id,daily_budget,status");
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", accessToken);
    const data = await graph<{ data?: Array<Record<string, unknown>> }>(
      url.toString(),
    );
    const a = data.data?.[0];
    if (!a) return null;
    return {
      id: String(a.id),
      dailyBudgetMinor: a.daily_budget != null ? Number(a.daily_budget) : null,
    };
  }

  async getAdSet(
    adSetId: string,
    accessToken: string,
  ): Promise<AdSetInfo | null> {
    const url = new URL(`${GRAPH_BASE}/${adSetId}`);
    url.searchParams.set("fields", "id,daily_budget");
    url.searchParams.set("access_token", accessToken);
    const a = await graph<Record<string, unknown>>(url.toString());
    if (!a?.id) return null;
    return {
      id: String(a.id),
      dailyBudgetMinor: a.daily_budget != null ? Number(a.daily_budget) : null,
    };
  }

  async updateAdSetBudget(
    adSetId: string,
    dailyBudgetMinor: number,
    accessToken: string,
  ): Promise<void> {
    const body = new URLSearchParams({
      daily_budget: String(dailyBudgetMinor),
      access_token: accessToken,
    });
    await graph(`${GRAPH_BASE}/${adSetId}`, { method: "POST", body });
  }

  async getDailyInsights(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<DailyInsight[]> {
    const url = new URL(`${GRAPH_BASE}/${query.externalCampaignId}/insights`);
    url.searchParams.set("fields", INSIGHT_FIELDS);
    url.searchParams.set("time_increment", "1");
    // High page size so a long (e.g. 1-year) daily range isn't paginated/truncated.
    url.searchParams.set("limit", "500");
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: query.since, until: query.until }),
    );
    url.searchParams.set("access_token", accessToken);
    const data = await graph<{ data?: Array<Record<string, unknown>> }>(
      url.toString(),
    );
    return (data.data ?? []).map((row) => ({
      date: String(row.date_start ?? query.since),
      ...parseInsightRow(row),
      raw: row,
    }));
  }

  async getCampaignBreakdown(
    query: InsightsQuery,
    accessToken: string,
  ): Promise<CampaignBreakdown> {
    const cid = query.externalCampaignId;
    const timeRange = JSON.stringify({ since: query.since, until: query.until });

    // Entity lists return every ad set / ad (even paused / no-delivery ones);
    // the insights breakdowns only return entities that had delivery in-window.
    // We fetch both and merge so the tables list everything with zeroed KPIs
    // where there's no spend yet.
    const listUrl = (edge: string, fields: string) => {
      const u = new URL(`${GRAPH_BASE}/${cid}/${edge}`);
      u.searchParams.set("fields", fields);
      u.searchParams.set("limit", "200");
      u.searchParams.set("access_token", accessToken);
      return u.toString();
    };
    const insightsUrl = (level: "adset" | "ad", idField: string) => {
      const u = new URL(`${GRAPH_BASE}/${cid}/insights`);
      u.searchParams.set("level", level);
      u.searchParams.set("fields", `${idField},${INSIGHT_FIELDS}`);
      u.searchParams.set("time_range", timeRange);
      u.searchParams.set("limit", "500");
      u.searchParams.set("access_token", accessToken);
      return u.toString();
    };

    type Rows = { data?: Array<Record<string, unknown>> };
    const [adSetList, adList, adSetInsights, adInsights] = await Promise.all([
      graph<Rows>(listUrl("adsets", "id,name,status,daily_budget,optimization_goal")),
      graph<Rows>(listUrl("ads", "id,name,status,adset_id")),
      graph<Rows>(insightsUrl("adset", "adset_id")),
      graph<Rows>(insightsUrl("ad", "ad_id")),
    ]);

    const kpiBy = (rows: Rows, idKey: string) => {
      const m = new Map<string, EntityKpis>();
      for (const row of rows.data ?? []) {
        const id = String(row[idKey] ?? "");
        if (id) m.set(id, parseInsightRow(row));
      }
      return m;
    };
    const zero: EntityKpis = {
      impressions: 0,
      reach: 0,
      clicks: 0,
      linkClicks: 0,
      spendMinor: 0,
      conversions: 0,
      conversionValueMinor: 0,
    };
    const adSetKpis = kpiBy(adSetInsights, "adset_id");
    const adKpis = kpiBy(adInsights, "ad_id");

    return {
      adSets: (adSetList.data ?? []).map((a) => {
        const id = String(a.id);
        return {
          id,
          name: String(a.name ?? "Untitled ad set"),
          status: String(a.status ?? ""),
          dailyBudgetMinor:
            a.daily_budget != null ? Number(a.daily_budget) : null,
          optimizationGoal:
            a.optimization_goal != null ? String(a.optimization_goal) : null,
          kpis: adSetKpis.get(id) ?? { ...zero },
        };
      }),
      ads: (adList.data ?? []).map((a) => {
        const id = String(a.id);
        return {
          id,
          name: String(a.name ?? "Untitled ad"),
          status: String(a.status ?? ""),
          adSetId: a.adset_id != null ? String(a.adset_id) : null,
          kpis: adKpis.get(id) ?? { ...zero },
        };
      }),
    };
  }

  async getEntityDailyInsights(
    query: InsightsQuery,
    level: "adset" | "ad",
    accessToken: string,
  ): Promise<EntityDailyInsight[]> {
    const idField = level === "adset" ? "adset_id" : "ad_id";
    const nameField = level === "adset" ? "adset_name" : "ad_name";
    const parentField = level === "adset" ? "campaign_id" : "adset_id";

    const url = new URL(`${GRAPH_BASE}/${query.externalCampaignId}/insights`);
    url.searchParams.set("level", level);
    url.searchParams.set(
      "fields",
      `${idField},${nameField},${parentField},${INSIGHT_FIELDS}`,
    );
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("limit", "500");
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: query.since, until: query.until }),
    );
    url.searchParams.set("access_token", accessToken);

    const rows = await graphPaged(url.toString());
    return rows.map((row) => ({
      level,
      externalId: String(row[idField] ?? ""),
      parentExternalId:
        level === "ad" && row.adset_id != null ? String(row.adset_id) : null,
      name: row[nameField] != null ? String(row[nameField]) : null,
      date: String(row.date_start ?? query.since),
      ...parseInsightRow(row),
      raw: row,
    }));
  }
}
