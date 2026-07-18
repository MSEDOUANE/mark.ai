import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnimationStudioClient } from "./animation-studio-client";

const steps = [
  "Upload image",
  "Set motion intent",
  "Generate clip",
  "Preview",
  "Download or reuse in Video Studio",
];

export default async function AnimationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-app-text-muted hover:text-app-text">
            ← Generate
          </Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Generate · Animation</p>
              <h1 className="mt-2 text-3xl font-bold">Animation</h1>
              <p className="mt-1 max-w-2xl text-sm text-app-text-muted">
                Animate a still image into motion, then hand it off to Video Studio or export it as a standalone clip.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[34rem]">
              {[
                ["Motion first", "Subtle camera push-in and movement"],
                ["Reuse ready", "Use the result in ads or stories"],
                ["Fast feedback", "Upload, animate, preview, iterate"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-app-surface/70 p-3">
                  <div className="text-sm font-semibold text-app-text">{title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-app-text-subtle">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-app-border bg-app-surface/60 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-app-text-subtle">Workflow</h2>
              <ol className="mt-3 space-y-2 text-sm text-app-text">
                {steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-white/10 bg-app-bg p-4">
              <h3 className="text-sm font-semibold text-app-text">Related paths</h3>
              <div className="mt-3 space-y-2 text-sm">
                <Link href="/dashboard/generate/product-photos" className="block rounded-lg border border-white/10 px-3 py-2 text-app-text hover:border-white/20 hover:text-white">
                  Start with a product photo
                </Link>
                <Link href="/dashboard/videos" className="block rounded-lg border border-white/10 px-3 py-2 text-app-text hover:border-white/20 hover:text-white">
                  Open Video Studio
                </Link>
                <Link href="/dashboard/creatives" className="block rounded-lg border border-white/10 px-3 py-2 text-app-text hover:border-white/20 hover:text-white">
                  Animate an ad creative
                </Link>
              </div>
            </div>
          </aside>

          <AnimationStudioClient />
        </section>
      </div>
    </main>
  );
}