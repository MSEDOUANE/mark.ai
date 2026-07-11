import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center px-6 py-16 text-zinc-100 sm:px-10 lg:px-16">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section>
          <div className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-zinc-300">
            AI Marketing Workspace
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-none tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            A cleaner way to run campaign decisions.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            MarkAI helps you draft strategy, generate creatives, and review real
            campaign performance with human approval before any spend changes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              Enter workspace
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
            >
              View dashboard
            </Link>
          </div>
          <div className="mt-10 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-2xl font-semibold text-zinc-100">Strategy</div>
              <p className="mt-1 text-zinc-400">Turn briefs into focused messaging and channel plans.</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-2xl font-semibold text-zinc-100">Control</div>
              <p className="mt-1 text-zinc-400">Keep approval gates between AI advice and spend.</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-2xl font-semibold text-zinc-100">Signals</div>
              <p className="mt-1 text-zinc-400">Review campaign metrics and optimization ideas in one feed.</p>
            </div>
          </div>
        </section>

        <section>
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Today</p>
                <h2 className="mt-2 text-2xl font-semibold">Campaign pulse</h2>
              </div>
              <div className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                Human approval active
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Creative queue</p>
                <p className="mt-3 text-3xl font-semibold">04</p>
                <p className="mt-2 text-sm text-zinc-400">Concepts being generated for the next approval round.</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Optimizer status</p>
                <p className="mt-3 text-3xl font-semibold">Ready</p>
                <p className="mt-2 text-sm text-zinc-400">Pull fresh metrics, then approve any scale or pause action manually.</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Sample workflow</span>
                <span className="text-zinc-200">Brief → Strategy → Launch</span>
              </div>
              <div className="mt-4 flex items-center gap-3 overflow-hidden">
                {[
                  "Write brief",
                  "Generate creative",
                  "Import campaign",
                  "Approve action",
                ].map((step) => (
                  <div
                    key={step}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
