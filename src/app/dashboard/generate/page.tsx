import Link from "next/link";

const CATEGORIES = ["All", "Images", "Text", "Audience"] as const;
type Category = (typeof CATEGORIES)[number];

interface AssetType {
  href: string;
  icon: string;
  label: string;
  description: string;
  badge?: "New" | "Soon";
  categories: Category[];
  preview: React.ReactNode;
}

const ASSETS: AssetType[] = [
  {
    href: "/dashboard/creatives/new",
    icon: "🎨",
    label: "Ad Creatives",
    description: "Generate high-converting branded ads with AI scoring in 4 sizes.",
    categories: ["All", "Images"],
    preview: (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-900/60 to-zinc-900">
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="h-2 w-3/4 rounded bg-white/70" />
          <div className="mt-1 h-1.5 w-1/2 rounded bg-white/40" />
          <div className="mt-2 h-2 w-1/4 rounded-full bg-violet-400" />
        </div>
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">92</div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/ad-copy",
    icon: "✍️",
    label: "Ad Copy",
    description: "Generate sales-driven copy using proven frameworks — AIDA, PAS, Hook-Story-Offer and more.",
    badge: "New",
    categories: ["All", "Text"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-zinc-800 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <div className="h-1.5 w-8 rounded bg-amber-400/60" />
        </div>
        {["w-full", "w-5/6", "w-4/5", "w-3/4"].map((w, i) => (
          <div key={i} className={`mt-1 h-1.5 rounded bg-zinc-600 ${w}`} />
        ))}
        <div className="mt-3 mb-2 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          <div className="h-1.5 w-6 rounded bg-blue-400/60" />
        </div>
        {["w-full", "w-5/6"].map((w, i) => (
          <div key={i} className={`mt-1 h-1.5 rounded bg-zinc-600 ${w}`} />
        ))}
      </div>
    ),
  },
  {
    href: "/dashboard/generate/social-captions",
    icon: "💬",
    label: "Social Captions",
    description: "Platform-optimized captions with hashtags for Instagram, TikTok, LinkedIn and more.",
    badge: "New",
    categories: ["All", "Text"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-zinc-800 p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-pink-500 to-orange-500" />
          <div className="h-1.5 w-12 rounded bg-zinc-600" />
        </div>
        <div className="space-y-1">
          {["w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"].map((w, i) => (
            <div key={i} className={`h-1.5 rounded bg-zinc-600 ${w}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["#brand", "#ad", "#sale"].map((tag) => (
            <span key={tag} className="rounded-full bg-blue-900/40 px-1.5 py-0.5 text-[9px] text-blue-400">{tag}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/personas",
    icon: "👥",
    label: "Buyer Personas",
    description: "AI-crafted buyer personas to sharpen targeting, messaging and audience segments.",
    badge: "New",
    categories: ["All", "Audience"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-zinc-800 p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
          <div>
            <div className="h-2 w-14 rounded bg-zinc-300" />
            <div className="mt-1 h-1.5 w-10 rounded bg-zinc-600" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full rounded bg-zinc-700" />
          <div className="h-1.5 w-4/5 rounded bg-zinc-700" />
          <div className="h-1.5 w-5/6 rounded bg-zinc-700" />
        </div>
        <div className="mt-2 flex gap-1">
          {["Meta", "TikTok", "Google"].map((p) => (
            <span key={p} className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">{p}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/stock-images",
    icon: "🖼️",
    label: "Stock Images",
    description: "Search millions of free stock photos and use them as creative backgrounds.",
    categories: ["All", "Images"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-sky-900/40 to-zinc-900 flex items-center justify-center">
        <svg className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      </div>
    ),
  },
  {
    href: "/dashboard/videos",
    icon: "🎬",
    label: "Video Ads",
    description: "Lip-synced UGC creator, storytelling, and showcase videos — AI scripts, voices, films, and cuts them; you edit any scene.",
    badge: "New",
    categories: ["All", "Images"],
    preview: (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-rose-900/50 to-zinc-900 flex items-center justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg">
          <svg className="h-5 w-5 translate-x-0.5 text-zinc-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">UGC · Voiced</span>
      </div>
    ),
  },
];

export default function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  // Next.js 16 requires awaiting searchParams even in server components
  // We use a Suspense-free approach: render synchronously with default
  const cat: string = "All"; // default; JS-filtered client-side via the tab links

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl">
            ✦
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI-Generated Assets</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Select the asset type you want to generate.
            </p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/dashboard/generate?cat=${c}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                cat === c || (c === "All" && !cat)
                  ? "border-amber-400 bg-amber-400/10 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}>
              {c}
            </Link>
          ))}
        </div>

        {/* Asset grid */}
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((a) => (
            <AssetCard key={a.href} asset={a} />
          ))}
        </div>
      </div>
    </main>
  );
}

function AssetCard({ asset: a }: { asset: AssetType }) {
  const isSoon = a.badge === "Soon";

  const inner = (
    <div className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-zinc-900 transition-all ${
      isSoon
        ? "border-zinc-800 opacity-60 cursor-not-allowed"
        : "border-zinc-800 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40"
    }`}>
      {/* Preview thumbnail */}
      <div className="relative h-36 overflow-hidden bg-zinc-950">
        {a.preview}
        {a.badge ? (
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            a.badge === "New"
              ? "bg-emerald-500/90 text-white"
              : "bg-zinc-700 text-zinc-400"
          }`}>
            {a.badge}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{a.icon}</span>
          <h3 className="font-semibold text-zinc-100">{a.label}</h3>
        </div>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{a.description}</p>

        {!isSoon ? (
          <div className="mt-4 flex items-center text-sm font-medium text-amber-400">
            Generate
            <svg className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-600">Coming soon</p>
        )}
      </div>
    </div>
  );

  if (isSoon) return <div key={a.href}>{inner}</div>;
  return <Link key={a.href} href={a.href} className="flex">{inner}</Link>;
}
