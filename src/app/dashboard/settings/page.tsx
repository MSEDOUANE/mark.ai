import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { AUTONOMY_LABELS } from "@/lib/manager/policy";
import {
  connectAdAccount,
  disconnectAdAccount,
  updateAutonomy,
} from "./actions";
import { inviteMember, cancelInvite, changeMemberRole, removeMember } from "./team-actions";
import { emailEnabled } from "@/lib/notify/email";

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

  const [members, invites] = await Promise.all([
    db
      .select({
        id: schema.memberships.id,
        userId: schema.memberships.userId,
        role: schema.memberships.role,
        email: schema.profiles.email,
        createdAt: schema.memberships.createdAt,
      })
      .from(schema.memberships)
      .innerJoin(schema.profiles, eq(schema.memberships.userId, schema.profiles.id))
      .where(eq(schema.memberships.orgId, org.id))
      .orderBy(schema.memberships.createdAt),
    db
      .select()
      .from(schema.pendingInvites)
      .where(and(eq(schema.pendingInvites.orgId, org.id), eq(schema.pendingInvites.status, "pending")))
      .orderBy(desc(schema.pendingInvites.createdAt)),
  ]);
  const myRole = members.find((m) => m.userId === user.id)?.role ?? "member";
  const canManageTeam = myRole === "owner" || myRole === "admin";

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
    "rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none focus:border-amber-300";

  return (
    <main className="min-h-screen px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">
          ← Dashboard
        </Link>
        <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">AI Manager autonomy</h2>
          <p className="mt-1 text-sm text-zinc-300">
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

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
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
              <p className="text-sm text-zinc-300">No ad accounts connected yet.</p>
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
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-zinc-50">
                        {name ?? `${a.platform} · ${a.externalId}`}
                      </div>
                      <div className="mt-1 text-xs text-zinc-300">
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
                      <button className="rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 hover:border-white/20">
                        Disconnect
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Connect an ad account</h2>
          <p className="mt-1 text-sm text-zinc-300">
            For the sandbox/own-use phase, paste an ad account id and access
            token. The token is encrypted at rest.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950 p-4">
            <h3 className="text-sm font-medium text-zinc-50">Meta OAuth diagnostics</h3>
            <div className="mt-3 space-y-1 text-xs text-zinc-300">
              <p>App URL: {appUrl || "missing"}</p>
              <p>Callback URL: {metaCallbackUrl || "missing"}</p>
              <p>Meta App ID: {hasMetaAppId ? metaAppIdHint : "missing"}</p>
              <p>Meta App Secret: {hasMetaAppSecret ? "loaded" : "missing"}</p>
              <p>Required scopes: ads_management, ads_read, business_management</p>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Add the exact callback URL above in Meta Login settings, then start
              a fresh OAuth flow from this page.
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-200">
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
          <p className="mt-2 text-xs text-zinc-400">
            Token tip: a Graph API Explorer token lasts ~1–2 hours. Set{" "}
            <code className="text-zinc-200">META_APP_ID</code> +{" "}
            <code className="text-zinc-200">META_APP_SECRET</code> in your env and
            MarkAI auto-exchanges it for a ~60-day token on connect. For a token that
            never expires, create a <strong>System User</strong> in Meta Business
            Settings → System Users → Generate token (with{" "}
            <code className="text-zinc-200">ads_management</code>), and paste that.
          </p>
          <form action={connectAdAccount} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Platform</span>
              <select name="platform" className={field} defaultValue="meta">
                <option value="meta">Meta (Facebook/Instagram)</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Ad account id</span>
              <input
                name="externalId"
                required
                placeholder="e.g. 1234567890 (Meta act id, no act_ prefix)"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Access token</span>
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
        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Team</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Who has access to this workspace.
          </p>

          <div className="mt-4 space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">
                    {m.email}
                    {m.userId === user.id && <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">You</span>}
                  </p>
                </div>
                {canManageTeam ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={changeMemberRole}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select name="role" defaultValue={m.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-300">
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </form>
                    {m.userId !== user.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="rounded-lg border border-red-400/25 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-400">{m.role}</span>
                )}
              </div>
            ))}
          </div>

          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Pending invites</p>
              <div className="mt-2 space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-4 py-2.5">
                    <span className="truncate text-sm text-zinc-300">{inv.email} <span className="text-zinc-600">· {inv.role}</span></span>
                    {canManageTeam && (
                      <form action={cancelInvite}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="shrink-0 text-xs text-zinc-500 hover:text-red-300">Cancel</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canManageTeam && (
            <form action={inviteMember} className="mt-5 flex flex-wrap items-end gap-2 border-t border-white/10 pt-4">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                <span className="text-zinc-300">Invite by email</span>
                <input name="email" type="email" required placeholder="teammate@company.com" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-300">Role</span>
                <select name="role" defaultValue="member" className={field}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <button className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
                Send invite
              </button>
            </form>
          )}
          {!emailEnabled() && canManageTeam && (
            <p className="mt-2 text-xs text-zinc-500">
              Email delivery isn&apos;t configured (RESEND_API_KEY) — invited teammates won&apos;t get an email, but the invite link still works if you share it directly.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
