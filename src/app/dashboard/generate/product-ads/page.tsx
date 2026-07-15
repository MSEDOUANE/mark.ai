import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoshootClient } from "../product-photos/photoshoot-client";

const steps = [
  "Upload product",
  "Detect object",
  "Remove background",
  "Choose scene",
  "Choose style",
  "Generate lifestyle image",
  "Generate ad variations",
  "Generate headlines",
  "Generate CTA",
  "Export",
];

export default async function ProductAdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Generate
          </Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Generate · Product Ads</p>
              <h1 className="mt-2 text-3xl font-bold">Product Ads</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Turn one product photo into ad-ready lifestyle visuals, headline variants, and CTA-ready assets.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[34rem]">
              {[
                ["One source", "Start with a single product upload"],
                ["Multi-output", "Lifestyle shots, ads, headlines, CTAs"],
                ["Reusable", "Save variants back to the library"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-zinc-900/70 p-3">
                  <div className="text-sm font-semibold text-zinc-50">{title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Workflow</h2>
              <ol className="mt-3 space-y-2 text-sm text-zinc-300">
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

            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-sm font-semibold text-zinc-50">Quick actions</h3>
              <div className="mt-3 space-y-2 text-sm">
                <Link href="/dashboard/generate/product-photos" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Product & fashion photoshoot
                </Link>
                <Link href="/dashboard/generate/batch" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Batch generate for multiple products
                </Link>
                <Link href="/dashboard/generate/ad-copy" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Pair with ad copy
                </Link>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <PhotoshootClient />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold">What this workflow should output</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Lifestyle image", "The product in a contextual scene"],
                  ["Variant pack", "Angle, scene, and composition changes"],
                  ["Ad copy", "Headline, primary text, and CTA"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3">
                    <div className="text-sm font-semibold text-zinc-50">{title}</div>
                    <div className="mt-1 text-sm text-zinc-500">{text}</div>
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