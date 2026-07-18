import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CARDS = [
  {
    href: "/dashboard/analyze/competitors",
    icon: "🔬",
    label: "Competitor Analysis",
    description: "Live competitor ads from the Meta Ad Library, plus an AI report on positioning, gaps, and angles.",
  },
  {
    href: "/dashboard/analyze/website",
    icon: "🌐",
    label: "Website Analysis",
    description: "Audit any website's messaging — value prop, offers, weaknesses, and suggested ad angles.",
  },
  {
    href: "/dashboard/campaigns",
    icon: "📈",
    label: "Campaign Performance",
    description: "Live Meta KPIs, trend charts, and daily metrics for every campaign — already in Campaigns.",
  },
  {
    href: "/dashboard/creatives",
    icon: "🎯",
    label: "Creative Insights",
    description: "Every creative's AI score, ranked — see which concepts are predicted to perform best.",
  },
];

export default async function AnalyzePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl">
            📊
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analyze</h1>
            <p className="mt-0.5 text-sm text-app-text-muted">
              Competitor research, website audits, and performance — in one place.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href}
              className="group flex flex-col rounded-2xl border border-app-border bg-app-surface p-6 transition-all hover:border-app-border-emphasis hover:shadow-xl hover:shadow-black/40">
              <span className="text-2xl">{c.icon}</span>
              <h3 className="mt-3 font-semibold text-app-text">{c.label}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-app-text-muted">{c.description}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-amber-400">
                Open
                <svg className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
