import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { encryptSecret } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeMetaOAuthCode,
  inspectMetaToken,
  listMetaAdAccounts,
  resolveMetaToken,
} from "@/lib/ads/meta-token";

const OAUTH_STATE_COOKIE = "meta_oauth_state";

function getAppBaseUrl(request: Request) {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin
  ).replace(/\/$/, "");
}

function redirectToSettings(request: Request, params: Record<string, string>) {
  const url = new URL("/dashboard/settings", request.url);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const error = reqUrl.searchParams.get("error");
  const errorDescription = reqUrl.searchParams.get("error_description");

  if (error) {
    return redirectToSettings(request, {
      error: `Meta OAuth failed: ${errorDescription ?? error}`,
    });
  }
  if (!code || !state) {
    return redirectToSettings(request, {
      error: "Missing OAuth code/state from Meta callback",
    });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return redirectToSettings(request, {
      error: "Invalid OAuth state. Please retry Meta connect.",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { org } = await ensureProfile(user);

  let step = "init";
  try {
    const redirectUri = `${getAppBaseUrl(request)}/api/oauth/meta/callback`;

    step = "exchangeMetaOAuthCode";
    const oauthToken = await exchangeMetaOAuthCode(code, redirectUri);
    step = "resolveMetaToken";
    const resolved = await resolveMetaToken(oauthToken.accessToken);
    const token = resolved.token;

    step = "inspect+listAdAccounts";
    const [inspection, adAccounts] = await Promise.all([
      inspectMetaToken(token),
      listMetaAdAccounts(token),
    ]);

    if (adAccounts.length === 0) {
      return redirectToSettings(request, {
        error:
          "Meta connected but no ad accounts are available for this user/business",
      });
    }

    const requiredScopes = ["ads_management", "ads_read"];
    const missingScopes = requiredScopes.filter(
      (s) => !(inspection?.scopes ?? []).includes(s),
    );

    const encryptedToken = encryptSecret(token);

    for (const a of adAccounts) {
      if (!a.accountId) continue;

      const [existing] = await db
        .select()
        .from(schema.adAccounts)
        .where(
          and(
            eq(schema.adAccounts.orgId, org.id),
            eq(schema.adAccounts.platform, "meta"),
            eq(schema.adAccounts.externalId, a.accountId),
          ),
        )
        .limit(1);

      const previousMeta = (existing?.meta ?? {}) as Record<string, unknown>;

      await db
        .insert(schema.adAccounts)
        .values({
          orgId: org.id,
          platform: "meta",
          externalId: a.accountId,
          encryptedToken,
          status: missingScopes.length ? "error" : "connected",
          meta: {
            ...previousMeta,
            tokenExpiresAt: resolved.expiresAt ?? inspection?.expiresAt ?? null,
            tokenExchanged: resolved.exchanged,
            tokenScopes: inspection?.scopes ?? [],
            oauthConnectedAt: new Date().toISOString(),
            metaAdAccountId: a.id,
            metaAdAccountName: a.name,
            currency: a.currency,
            timezoneName: a.timezoneName,
            missingScopes,
          },
        })
        .onConflictDoUpdate({
          target: [
            schema.adAccounts.orgId,
            schema.adAccounts.platform,
            schema.adAccounts.externalId,
          ],
          set: {
            encryptedToken,
            status: missingScopes.length ? "error" : "connected",
            meta: {
              ...previousMeta,
              tokenExpiresAt: resolved.expiresAt ?? inspection?.expiresAt ?? null,
              tokenExchanged: resolved.exchanged,
              tokenScopes: inspection?.scopes ?? [],
              oauthConnectedAt: new Date().toISOString(),
              metaAdAccountId: a.id,
              metaAdAccountName: a.name,
              currency: a.currency,
              timezoneName: a.timezoneName,
              missingScopes,
            },
          },
        });
    }

    const info = `Connected ${adAccounts.length} Meta ad account(s) via OAuth`;
    if (missingScopes.length) {
      return redirectToSettings(request, {
        warning: `Connected, but missing required permissions: ${missingScopes.join(", ")}`,
        info,
      });
    }

    return redirectToSettings(request, { info });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[meta-oauth] FAILED at step=${step}:`, message);
    const callbackUrl = `${getAppBaseUrl(request)}/api/oauth/meta/callback`;
    const appIdHint = process.env.META_APP_ID
      ? `...${process.env.META_APP_ID.slice(-6)}`
      : "missing";
    const help = /validating client secret/i.test(message)
      ? `Meta rejected the app credentials used during code exchange. Callback URL: ${callbackUrl}. Meta App ID: ${appIdHint}. Verify this exact callback URL is allowed in Meta Login settings and that META_APP_ID/META_APP_SECRET belong to the same Meta app in the running environment.`
      : message;
    return redirectToSettings(request, {
      error: `Meta OAuth callback failed: ${help}`,
    });
  }
}
