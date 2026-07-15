import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AudioStudioClient } from "../audio/audio-studio-client";

const steps = [
  "Select language",
  "Choose voice",
  "Enter script",
  "Preview pronunciation",
  "Generate voiceover",
  "Add music bed",
  "Export",
];

export default async function VoicePage() {
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
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Generate · Voice</p>
              <h1 className="mt-2 text-3xl font-bold">Voice</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Create voiceovers, narration, commercial reads, and voice clones with language and dialect control.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[34rem]">
              {[
                ["Multilingual", "EN, FR, and Arabic voice support"],
                ["Brand tone", "Match the voice to the brand memory"],
                ["Export ready", "Use the result in video and ads"],
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
              <h3 className="text-sm font-semibold text-zinc-50">Related workflows</h3>
              <div className="mt-3 space-y-2 text-sm">
                <Link href="/dashboard/generate/audio" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Voiceover & audio studio
                </Link>
                <Link href="/dashboard/videos" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Build a full video with voice
                </Link>
                <Link href="/dashboard/generate/ad-copy" className="block rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:border-white/20 hover:text-white">
                  Generate script first
                </Link>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <AudioStudioClient />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold">Voice use cases</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Ads", "Hook, proof, CTA"],
                  ["Narration", "Explain a product or brand story"],
                  ["Cloning", "Reuse a recognizable voice"],
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