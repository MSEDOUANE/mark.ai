import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { LandingContent } from "@/lib/ai/landing";

export const dynamic = "force-dynamic";

type Kit = {
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
};

const hex = (c: string | null | undefined, fb: string) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : fb;

function Cta({
  href,
  label,
  accent,
  big = false,
}: {
  href: string;
  label: string;
  accent: string;
  big?: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-block rounded-full font-bold text-zinc-950 shadow-lg transition-transform hover:scale-[1.02] ${
        big ? "px-10 py-4 text-lg" : "px-8 py-3.5 text-base"
      }`}
      style={{ backgroundColor: accent }}
    >
      {label}
    </a>
  );
}

/** Public landing page — the ad-click destination. No auth, no dashboard chrome. */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page] = await db
    .select()
    .from(schema.landingPages)
    .where(eq(schema.landingPages.slug, slug))
    .limit(1);
  if (!page) notFound();

  const c = page.content as LandingContent;
  const kit = (page.brand ?? {}) as Kit;
  const primary = hex(kit.primaryColor, "#18181b");
  const accent = hex(kit.accentColor, "#f59e0b");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section
        className="px-6 pb-20 pt-14 text-center"
        style={{
          background: `linear-gradient(160deg, ${primary} 0%, #09090b 85%)`,
        }}
      >
        {kit.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kit.logoUrl}
            alt=""
            className="mx-auto mb-10 h-12 w-auto max-w-[180px] object-contain"
          />
        ) : null}
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          {c.heroHeadline}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">
          {c.heroSubheadline}
        </p>
        <div className="mt-9">
          <Cta href={page.ctaHref} label={c.ctaLabel} accent={accent} big />
        </div>
        {kit.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kit.photoUrl}
            alt={page.title}
            className="mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-white/10 object-cover shadow-2xl"
          />
        ) : null}
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {c.benefits.map((b, i) => (
            <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <div
                className="mb-4 h-1.5 w-10 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <h3 className="font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {b.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm italic text-zinc-500">
          {c.socialProof}
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-6 pb-16">
        <h2 className="text-center text-2xl font-bold">Questions</h2>
        <div className="mt-8 space-y-4">
          {c.faq.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <summary className="cursor-pointer list-none font-medium">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="px-6 py-16 text-center"
        style={{
          background: `linear-gradient(0deg, ${primary}33 0%, transparent 100%)`,
        }}
      >
        <p className="mx-auto max-w-xl text-lg font-medium">{c.offer}</p>
        <div className="mt-7">
          <Cta href={page.ctaHref} label={c.ctaLabel} accent={accent} big />
        </div>
      </section>
    </main>
  );
}
