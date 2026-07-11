/**
 * Meta Ad Library (ads_archive) — see the ads competitors are actually
 * running. Coverage note: commercial (non-political) ads are only exposed for
 * EU countries (DSA transparency), so query EU markets — e.g. FR works, MA
 * does not. Any valid user access token works for EU transparency data.
 */

const GRAPH_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface CompetitorAd {
  pageName: string;
  bodies: string[];
  linkTitles: string[];
  startedAt: string | null;
  platforms: string[];
  snapshotUrl: string | null;
}

export interface AdLibraryQuery {
  /** Free-text search (brand/product name) — or use pageId for exact pages. */
  searchTerms?: string;
  /** Exact Facebook Page id to list that page's ads. */
  pageId?: string;
  /** ISO-3166 alpha-2; must be EU countries for commercial ads (e.g. ["FR"]). */
  countries: string[];
  limit?: number;
}

export async function searchAdLibrary(
  query: AdLibraryQuery,
  accessToken: string,
): Promise<CompetitorAd[]> {
  const url = new URL(`${GRAPH_BASE}/ads_archive`);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set(
    "ad_reached_countries",
    JSON.stringify(query.countries),
  );
  if (query.pageId) {
    url.searchParams.set("search_page_ids", JSON.stringify([query.pageId]));
  } else if (query.searchTerms) {
    url.searchParams.set("search_terms", query.searchTerms);
  } else {
    throw new Error("Provide searchTerms or pageId");
  }
  url.searchParams.set(
    "fields",
    [
      "page_name",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_delivery_start_time",
      "publisher_platforms",
      "ad_snapshot_url",
    ].join(","),
  );
  url.searchParams.set("limit", String(Math.min(query.limit ?? 10, 25)));
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    data?: Array<Record<string, unknown>>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Ad Library error ${res.status}`);
  }

  return (json.data ?? []).map((a) => ({
    pageName: String(a.page_name ?? "Unknown page"),
    bodies: Array.isArray(a.ad_creative_bodies)
      ? (a.ad_creative_bodies as string[]).slice(0, 2)
      : [],
    linkTitles: Array.isArray(a.ad_creative_link_titles)
      ? (a.ad_creative_link_titles as string[]).slice(0, 2)
      : [],
    startedAt: a.ad_delivery_start_time ? String(a.ad_delivery_start_time) : null,
    platforms: Array.isArray(a.publisher_platforms)
      ? (a.publisher_platforms as string[])
      : [],
    snapshotUrl: a.ad_snapshot_url ? String(a.ad_snapshot_url) : null,
  }));
}
