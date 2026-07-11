import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OAUTH_STATE_COOKIE = "meta_oauth_state";

function getAppBaseUrl(request: Request) {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin
  ).replace(/\/$/, "");
}

function toSettingsRedirect(request: Request, error: string) {
  const url = new URL("/dashboard/settings", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return toSettingsRedirect(
      request,
      "Set META_APP_ID and META_APP_SECRET before using Meta OAuth",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${getAppBaseUrl(request)}/api/oauth/meta/callback`;

  const authUrl = new URL(
    `https://www.facebook.com/${process.env.META_API_VERSION ?? "v21.0"}/dialog/oauth`,
  );
  authUrl.searchParams.set("client_id", process.env.META_APP_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  // Business-type apps use Facebook Login *for Business*: the permissions come
  // from a saved configuration (config_id), not the legacy `scope` param.
  // Fall back to classic scope-based login when no config id is set.
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) {
    authUrl.searchParams.set("config_id", configId);
    authUrl.searchParams.set("override_default_response_type", "true");
  } else {
    authUrl.searchParams.set(
      "scope",
      "ads_management,ads_read,business_management",
    );
  }

  const response = NextResponse.redirect(authUrl);
  (await cookies()).set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
