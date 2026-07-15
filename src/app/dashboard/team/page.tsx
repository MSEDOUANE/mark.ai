import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import {
  inviteMember,
  cancelInvite,
  changeMemberRole,
  removeMember,
} from "../settings/team-actions";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

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
      .where(
        and(
          eq(schema.pendingInvites.orgId, org.id),
          eq(schema.pendingInvites.status, "pending"),
        ),
      )
      .orderBy(desc(schema.pendingInvites.createdAt)),
  ]);

  const myRole = members.find((m) => m.userId === user.id)?.role ?? "member";
  const canManageTeam = myRole === "owner" || myRole === "admin";

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Invite members, change roles, and keep the approval model explicit.
          </p>
        </div>

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Invite member</h2>
          <form action={inviteMember} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-zinc-300">Email</span>
              <input
                name="email"
                type="email"
                required
                className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none focus:border-amber-300"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-zinc-300">Role</span>
              <select
                name="role"
                defaultValue="member"
                className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none focus:border-amber-300"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            </label>
            <button className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Send invite
            </button>
          </form>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Members</h2>
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">
                    {m.email}
                    {m.userId === user.id ? (
                      <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Joined {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canManageTeam ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={changeMemberRole}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        onChange={(event) => event.currentTarget.form?.requestSubmit()}
                        className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-300"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </form>
                    {m.userId !== user.id ? (
                      <form action={removeMember}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="rounded-lg border border-red-400/25 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Read only</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Pending invites</h2>
          <div className="mt-3 space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-zinc-400">No pending invites.</p>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-zinc-100">{invite.email}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Role: {invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canManageTeam ? (
                    <form action={cancelInvite}>
                      <input type="hidden" name="id" value={invite.id} />
                      <button className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-900">
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}