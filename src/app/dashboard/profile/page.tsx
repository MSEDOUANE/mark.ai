import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org, profile } = await ensureProfile(user);

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">
          ← Dashboard
        </Link>

        <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Personal account information and workspace identity.
          </p>
        </div>

        <section className="mt-4 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
          <h2 className="text-lg font-medium">Account</h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            <p>Email: {profile.email}</p>
            <p>Name: {profile.fullName ?? "Not set"}</p>
            <p>Workspace: {org.name}</p>
            <p>Autonomy: {org.autonomyLevel}</p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/settings" className="rounded-xl border border-white/10 bg-zinc-900/80 p-4 hover:border-white/20">
            <div className="text-sm font-semibold text-zinc-50">Security and integrations</div>
            <p className="mt-1 text-sm text-zinc-400">Manage OAuth, ad accounts, and autonomy settings.</p>
          </Link>
          <Link href="/dashboard/team" className="rounded-xl border border-white/10 bg-zinc-900/80 p-4 hover:border-white/20">
            <div className="text-sm font-semibold text-zinc-50">Team access</div>
            <p className="mt-1 text-sm text-zinc-400">Review members, invites, and role assignments.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}