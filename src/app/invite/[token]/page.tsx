import Link from "next/link";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { acceptInvite } from "./actions";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invite] = await db
    .select()
    .from(schema.pendingInvites)
    .where(eq(schema.pendingInvites.token, token))
    .limit(1);

  const shell = (body: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        {body}
      </div>
    </main>
  );

  if (!invite) {
    return shell(
      <>
        <p className="text-3xl">🔗</p>
        <h1 className="mt-3 text-lg font-bold">Invite not found</h1>
        <p className="mt-2 text-sm text-zinc-400">This invite link is invalid or has already been used.</p>
      </>,
    );
  }

  if (invite.status !== "pending") {
    return shell(
      <>
        <p className="text-3xl">✓</p>
        <h1 className="mt-3 text-lg font-bold">Invite already used</h1>
        <p className="mt-2 text-sm text-zinc-400">This invite has already been accepted or revoked.</p>
      </>,
    );
  }

  // eslint-disable-next-line react-hooks/purity -- per-request server component; "now" is intentional
  if (invite.expiresAt.getTime() < Date.now()) {
    return shell(
      <>
        <p className="text-3xl">⏰</p>
        <h1 className="mt-3 text-lg font-bold">Invite expired</h1>
        <p className="mt-2 text-sm text-zinc-400">Ask whoever invited you to send a new one.</p>
      </>,
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return shell(
      <>
        <p className="text-3xl">✉️</p>
        <h1 className="mt-3 text-lg font-bold">You&apos;re invited</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Log in or sign up with <strong className="text-zinc-200">{invite.email}</strong> to accept as{" "}
          <strong className="text-zinc-200">{invite.role}</strong>.
        </p>
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-5 inline-block rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
          Log in / Sign up →
        </Link>
      </>,
    );
  }

  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return shell(
      <>
        <p className="text-3xl">⚠️</p>
        <h1 className="mt-3 text-lg font-bold">Wrong account</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This invite is for <strong className="text-zinc-200">{invite.email}</strong>, but you&apos;re signed in as{" "}
          {user.email}. Log out and try again with the invited email.
        </p>
      </>,
    );
  }

  // Ensures a membership row exists (via the single-tenant auth bridge),
  // then the accept action promotes/sets it to the invited role.
  await ensureProfile(user);

  return shell(
    <>
      <p className="text-3xl">✉️</p>
      <h1 className="mt-3 text-lg font-bold">Join as {invite.role}</h1>
      <p className="mt-2 text-sm text-zinc-400">Signed in as {user.email}.</p>
      <form action={acceptInvite} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="w-full rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
          Accept invite →
        </button>
      </form>
    </>,
  );
}
