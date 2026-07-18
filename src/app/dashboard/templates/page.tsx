import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import {
  creativeArtwork,
  CREATIVE_SIZES,
  type CreativeTemplate,
} from "@/lib/creative/design";

/**
 * Live template gallery — reuses creativeArtwork() (the exact source powering
 * real rendered creatives) directly as React elements. Since creativeArtwork
 * only produces plain divs/imgs with inline styles (no Satori-specific
 * magic), it renders correctly in a normal browser DOM too — this page is a
 * true WYSIWYG preview, not a mockup, with zero fal.ai / font-loading
 * dependency (no brand font set → default sans, same as the app's own
 * brand-less default).
 */

const SAMPLE_COPY = {
  headline: "Your Headline Here",
  primaryText: "A short, compelling line about your offer.",
  callToAction: "Shop Now",
};

const TEMPLATES: Array<{ id: CreativeTemplate; label: string; desc: string }> = [
  { id: "overlay", label: "Overlay", desc: "Full-bleed image, text and CTA at the bottom. Best for lifestyle and emotion-led ads." },
  { id: "split", label: "Split", desc: "Image on one side, content on the other. Best for product features and editorial framing." },
  { id: "bold", label: "Bold", desc: "Giant centered headline on a gradient. Best for announcements and offers." },
];

const SIZE_INFO: Record<string, { label: string; ratio: string }> = {
  square: { label: "Feed (square)", ratio: "1:1" },
  portrait: { label: "Feed (portrait)", ratio: "4:5" },
  story: { label: "Stories / Reels", ratio: "9:16" },
  link: { label: "Link / Display", ratio: "1.91:1" },
  landscape: { label: "Video / Landscape", ratio: "16:9" },
};

const THUMB_SIZES = ["square", "story", "link", "landscape"] as const;

function ScaledPreview({
  element,
  width,
  height,
  displayWidth,
}: {
  element: React.ReactElement;
  width: number;
  height: number;
  displayWidth: number;
}) {
  const scale = displayWidth / width;
  const displayHeight = Math.round(height * scale);
  return (
    <div
      style={{ width: displayWidth, height: displayHeight, overflow: "hidden", position: "relative" }}
      className="rounded-xl bg-app-bg"
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {element}
      </div>
    </div>
  );
}

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            The layout templates every generated creative uses — pick one to start, or let AI auto-select in Ad Creatives.
            Previews use the app&apos;s default palette; your brand colors, logo, and font apply automatically once you pick a brand.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const main = creativeArtwork(
              { ...SAMPLE_COPY, template: t.id },
              "portrait",
            );
            return (
              <div key={t.id} className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
                <ScaledPreview element={main.element} width={main.width} height={main.height} displayWidth={280} />

                <h2 className="mt-4 text-lg font-bold">{t.label}</h2>
                <p className="mt-1 text-sm text-app-text-muted">{t.desc}</p>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-app-text-subtle">Also generates</p>
                  <div className="flex flex-wrap gap-2">
                    {THUMB_SIZES.map((sizeKey) => {
                      const thumb = creativeArtwork({ ...SAMPLE_COPY, template: t.id }, sizeKey);
                      const info = SIZE_INFO[sizeKey];
                      return (
                        <div key={sizeKey} className="text-center">
                          <ScaledPreview element={thumb.element} width={thumb.width} height={thumb.height} displayWidth={64} />
                          <p className="mt-1 text-[9px] text-app-text-subtle">{info.ratio}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Link
                  href={`/dashboard/creatives/new?template=${t.id}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
                >
                  Use this template →
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-app-border bg-app-surface/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-app-text-subtle">Every size, every template</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(CREATIVE_SIZES) as Array<keyof typeof CREATIVE_SIZES>).map((k) => (
              <div key={k} className="rounded-xl border border-app-border bg-app-bg/60 px-3 py-2.5">
                <p className="text-xs font-medium text-app-text">{SIZE_INFO[k]?.label ?? k}</p>
                <p className="mt-0.5 text-[11px] text-app-text-subtle">
                  {SIZE_INFO[k]?.ratio} · {CREATIVE_SIZES[k].w}×{CREATIVE_SIZES[k].h}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-app-text-subtle">
            Every creative you generate produces all 5 sizes automatically in whichever template you pick — no need to choose per size.
          </p>
        </div>
      </div>
    </main>
  );
}
