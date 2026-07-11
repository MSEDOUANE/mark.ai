const GRAPH_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = (data.error ?? {}) as {
      message?: string;
      code?: number;
      error_subcode?: number;
    };
    const bits = [
      error.message,
      error.code != null ? `code ${error.code}` : null,
      error.error_subcode != null ? `subcode ${error.error_subcode}` : null,
    ].filter(Boolean);
    throw new Error(bits.length ? bits.join(" - ") : `HTTP ${res.status}`);
  }
  return data as T;
}

export interface TokenResult {
  token: string;
  /** ISO expiry, or null when long-lived / non-expiring (e.g. system-user). */
  expiresAt: string | null;
  exchanged: boolean;
}

export interface MetaAdAccountSummary {
  id: string;
  accountId: string;
  name: string | null;
  status: number | null;
  currency: string | null;
  timezoneName: string | null;
}

export interface MetaTokenInspection {
  scopes: string[];
  expiresAt: string | null;
  isValid: boolean;
}

/** Exchange OAuth authorization code for a user access token. */
export async function exchangeMetaOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET are required");
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const data = await graph<{ access_token?: string; expires_in?: number }>(
    url.toString(),
  );
  if (!data.access_token) {
    throw new Error("Meta did not return an access token");
  }

  const expiresAt =
    data.expires_in && data.expires_in > 0
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;
  return { accessToken: data.access_token, expiresAt };
}

/** Inspect token validity/scope using /debug_token when app creds are available. */
export async function inspectMetaToken(
  token: string,
): Promise<MetaTokenInspection | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;

  const url = new URL(`${GRAPH_BASE}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const data = await graph<{
    data?: {
      is_valid?: boolean;
      scopes?: string[];
      expires_at?: number;
    };
  }>(url.toString());

  const d = data.data;
  if (!d) return null;
  return {
    scopes: Array.isArray(d.scopes) ? d.scopes : [],
    isValid: Boolean(d.is_valid),
    expiresAt:
      d.expires_at && d.expires_at > 0
        ? new Date(d.expires_at * 1000).toISOString()
        : null,
  };
}

/** List ad accounts available to the current Meta user token. */
export async function listMetaAdAccounts(
  accessToken: string,
): Promise<MetaAdAccountSummary[]> {
  const url = new URL(`${GRAPH_BASE}/me/adaccounts`);
  url.searchParams.set(
    "fields",
    "id,account_id,name,account_status,currency,timezone_name",
  );
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", accessToken);

  const data = await graph<{ data?: Array<Record<string, unknown>> }>(
    url.toString(),
  );
  return (data.data ?? []).map((a) => {
    const accountId = String(a.account_id ?? a.id ?? "").replace(/^act_/, "");
    return {
      id: String(a.id ?? ""),
      accountId,
      name: a.name != null ? String(a.name) : null,
      status: a.account_status != null ? Number(a.account_status) : null,
      currency: a.currency != null ? String(a.currency) : null,
      timezoneName: a.timezone_name != null ? String(a.timezone_name) : null,
    };
  });
}

/**
 * Resolve a pasted Meta token into the longest-lived form we can:
 *  - If META_APP_ID + META_APP_SECRET are set, exchange a short-lived token for
 *    a ~60-day long-lived one (`fb_exchange_token`).
 *  - If app creds are missing or the exchange fails (already long-lived, a
 *    system-user token, or invalid), keep the pasted token as-is.
 *
 * This is the fix for Graph API Explorer tokens expiring in ~1–2 hours.
 */
export async function resolveMetaToken(shortToken: string): Promise<TokenResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { token: shortToken, expiresAt: null, exchanged: false };
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !data.access_token) {
      return { token: shortToken, expiresAt: null, exchanged: false };
    }
    // expires_in of 0 / absent => effectively non-expiring (e.g. system user).
    const expiresAt =
      data.expires_in && data.expires_in > 0
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null;
    return { token: data.access_token, expiresAt, exchanged: true };
  } catch {
    return { token: shortToken, expiresAt: null, exchanged: false };
  }
}
