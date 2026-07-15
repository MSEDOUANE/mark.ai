import Link from "next/link";

/** Lightweight placeholder for dashboard sections that are being built out. */
export function ComingSoon({
  icon,
  title,
  blurb,
  bullets,
}: {
  icon: string;
  title: string;
  blurb: string;
  bullets: string[];
}) {
  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{title}</h1>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                Soon
              </span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-400">{blurb}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-sm font-medium text-zinc-300">What&rsquo;s coming</p>
          <ul className="mt-3 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/dashboard/generate"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          ← Back to Generate
        </Link>
      </div>
    </main>
  );
}
