import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100 sm:px-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.6rem] border border-zinc-800 bg-zinc-900 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden border-r border-zinc-800 px-8 py-10 lg:block">
          <div>
            <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-zinc-300">
              MarkAI Workspace
            </div>
            <h1 className="mt-8 max-w-sm text-4xl font-semibold leading-tight tracking-[-0.03em]">
              Plan, review, and approve campaigns.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-400">
              Keep strategy, creatives, and optimization decisions in one clean workflow.
            </p>
            <div className="mt-10 space-y-4">
              {[
                ["Brief to strategy", "Turn a product idea into structured marketing direction."],
                ["Creative pipeline", "Generate and review assets before anything goes live."],
                ["Spend guardrails", "Keep real campaign actions behind explicit approval."],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <h2 className="text-sm font-semibold text-stone-50">{title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to your marketing copilot.
          </p>

          <form className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-stone-50 outline-none focus:border-zinc-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-stone-50 outline-none focus:border-zinc-500"
              />
            </label>

            {error ? (
              <p className="rounded-2xl border border-red-400/20 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <div className="mt-2 flex gap-3">
              <button
                formAction={login}
                className="flex-1 rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Log in
              </button>
              <button
                formAction={signup}
                className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-stone-50 hover:bg-zinc-800"
              >
                Sign up
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
