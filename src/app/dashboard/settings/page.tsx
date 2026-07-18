import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { AUTONOMY_LABELS } from "@/lib/manager/policy";
import {
  connectAdAccount,
  disconnectAdAccount,
  updateAutonomy,
} from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string; warning?: string }>;
}) {
  const { error, info, warning } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const accounts = await db
    .select()
    .from(schema.adAccounts)
    .where(eq(schema.adAccounts.orgId, org.id))
    .orderBy(desc(schema.adAccounts.createdAt));

  const appUrl = (
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
  ).replace(/\/$/, "");
  const metaCallbackUrl = appUrl ? `${appUrl}/api/oauth/meta/callback` : null;
  const hasMetaAppId = Boolean(process.env.META_APP_ID);
  const hasMetaAppSecret = Boolean(process.env.META_APP_SECRET);
  const metaAppIdHint = process.env.META_APP_ID
    ? `...${process.env.META_APP_ID.slice(-6)}`
    : "missing";

  const field =
    "rounded-xl border border-white/10 bg-app-bg px-4 py-3 text-sm text-app-text outline-none focus:border-amber-300";

  return (
    <main className="min-h-screen px-4 py-5 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-app-text hover:text-white">
          ← Dashboard
        </Link>
        <div className="mt-3 rounded-xl border border-white/10 bg-app-surface/80 p-4 backdrop-blur-sm">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <section className="mt-4 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">AI Manager autonomy</h2>
          <p className="mt-1 text-sm text-app-text">
            How much the AI does on its own. Anything that starts or increases ad
            spend can require your approval.
          </p>
          <form action={updateAutonomy} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <select
              name="autonomyLevel"
              defaultValue={org.autonomyLevel}
              className={`${field} w-full sm:flex-1`}
            >
              <option value="approve_all">{AUTONOMY_LABELS.approve_all}</option>
              <option value="approve_spend">{AUTONOMY_LABELS.approve_spend}</option>
              <option value="full_auto">{AUTONOMY_LABELS.full_auto}</option>
            </select>
            <button className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 sm:w-auto">
              Save
            </button>
          </form>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">Connected ad accounts</h2>
          {info ? (
            <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-950/45 p-4 text-sm text-emerald-100">
              {info}
            </p>
          ) : null}
          {warning ? (
            <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-950/40 p-4 text-sm text-amber-100">
              {warning}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-app-text">No ad accounts connected yet.</p>
            ) : (
              accounts.map((a) => {
                const meta = (a.meta ?? {}) as {
                  tokenExpiresAt?: string | null;
                  missingScopes?: string[];
                  metaAdAccountName?: string | null;
                  currency?: string | null;
                };
                const name =
                  a.platform === "meta" && meta.metaAdAccountName
                    ? meta.metaAdAccountName
                    : null;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-app-bg px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-app-text">
                        {name ?? `${a.platform} · ${a.externalId}`}
                      </div>
                      <div className="mt-1 text-xs text-app-text">
                        {a.platform} · {a.externalId}
                        {meta.currency ? ` · ${meta.currency}` : ""} · {a.status}
                        {(() => {
                          if (a.platform !== "meta") return null;
                          if (Array.isArray(meta.missingScopes) && meta.missingScopes.length) {
                            return ` · missing perms: ${meta.missingScopes.join(", ")}`;
                          }
                          if (!meta.tokenExpiresAt)
                            return " · token: long-lived / system user";
                          const days = Math.round(
                            (new Date(meta.tokenExpiresAt).getTime() - Date.now()) /
                              86_400_000,
                          );
                          return days <= 0
                            ? " · ⚠ token expired — reconnect"
                            : ` · token expires in ${days} day(s)`;
                        })()}
                      </div>
                    </div>
                    <form action={disconnectAdAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-full border border-white/10 bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface-2 hover:border-white/20">
                        Disconnect
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">Connect an ad account</h2>
          <p className="mt-1 text-sm text-app-text">
            For the sandbox/own-use phase, paste an ad account id and access
            token. The token is encrypted at rest.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-app-bg p-4">
            <h3 className="text-sm font-medium text-app-text">Meta OAuth diagnostics</h3>
            <div className="mt-3 space-y-1 text-xs text-app-text">
              <p>App URL: {appUrl || "missing"}</p>
              <p>Callback URL: {metaCallbackUrl || "missing"}</p>
              <p>Meta App ID: {hasMetaAppId ? metaAppIdHint : "missing"}</p>
              <p>Meta App Secret: {hasMetaAppSecret ? "loaded" : "missing"}</p>
              <p>Required scopes: ads_management, ads_read, business_management</p>
            </div>
            <p className="mt-3 text-xs text-app-text-muted">
              Add the exact callback URL above in Meta Login settings, then start
              a fresh OAuth flow from this page.
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-app-bg p-4">
            <p className="text-sm text-app-text">
              SaaS path (recommended): connect through Meta OAuth and auto-link your
              authorized ad accounts.
            </p>
            <div className="mt-3">
              <a
                href="/api/oauth/meta/start"
                className="inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
              >
                Connect with Facebook (OAuth)
              </a>
            </div>
          </div>
          <p className="mt-2 text-xs text-app-text-muted">
            Token tip: a Graph API Explorer token lasts ~1–2 hours. Set{" "}
            <code className="text-app-text">META_APP_ID</code> +{" "}
            <code className="text-app-text">META_APP_SECRET</code> in your env and
            MarkAI auto-exchanges it for a ~60-day token on connect. For a token that
            never expires, create a <strong>System User</strong> in Meta Business
            Settings → System Users → Generate token (with{" "}
            <code className="text-app-text">ads_management</code>), and paste that.
          </p>
          <form action={connectAdAccount} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text">Platform</span>
              <select name="platform" className={field} defaultValue="meta">
                <option value="meta">Meta (Facebook/Instagram)</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text">Ad account id</span>
              <input
                name="externalId"
                required
                placeholder="e.g. 1234567890 (Meta act id, no act_ prefix)"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text">Access token</span>
              <input name="accessToken" type="password" required className={field} />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-300/25 bg-red-950/45 p-4 text-sm text-red-100">
                {error}
              </p>
            ) : null}
            <div>
              <button className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
                Connect
              </button>
            </div>
          </form>
        </section>

        {/* ── Team ──────────────────────────────────────────────────────── */}
        <section className="mt-4 rounded-xl border border-white/10 bg-app-surface/80 p-4">
          <h2 className="text-lg font-medium">Team</h2>
          <p className="mt-1 text-sm text-app-text">
            Invite members, change roles, and manage workspace access on the
            dedicated Team Management page.
          </p>
          <Link
            href="/dashboard/team"
            className="mt-3 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
          >
            Manage team →
          </Link>
        </section>
      </div>
    </main>
  );
}
