import Link from "next/link";

const CATEGORIES = [
  "Most Popular",
  "Images",
  "Videos",
  "Product Ads",
  "Social Posts",
  "Text",
  "Audience",
  "Voice",
  "Audio",
  "Animation",
] as const;
type Category = (typeof CATEGORIES)[number];

interface AssetType {
  href: string;
  icon: string;
  label: string;
  description: string;
  badge?: "New" | "Soon";
  categories: (Category | "All")[];
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
    label: "Copy & Content",
    description: "Ad copy, product descriptions, and marketing content — AIDA, PAS, Hook-Story-Offer and more.",
    badge: "New",
    categories: ["All", "Text", "Most Popular"],
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
    categories: ["All", "Text", "Social Posts", "Most Popular"],
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
    categories: ["All", "Audience", "Most Popular"],
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
    href: "/dashboard/generate/audience-insights",
    icon: "🔎",
    label: "Audience Insights",
    description: "Break your market into actionable segments — demographics, behavior, and channels.",
    badge: "New",
    categories: ["All", "Audience"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-zinc-800 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-zinc-700/60 p-1.5">
              <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600" />
              <div className="mt-1 h-1 w-full rounded bg-zinc-600" />
              <div className="mt-0.5 h-1 w-2/3 rounded bg-zinc-600" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/product-photos",
    icon: "📸",
    label: "Product Photo Ads",
    description: "Turn one product photo into professional studio shots — clean background, lifestyle, editorial, and more.",
    badge: "New",
    categories: ["All", "Images", "Product Ads"],
    preview: (
      <div className="grid h-full w-full grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-zinc-950">
        <div className="flex items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-400">
          <span className="text-lg">👟</span>
        </div>
        <div className="flex items-center justify-center bg-gradient-to-br from-amber-900/50 to-zinc-900">
          <span className="text-lg">👟</span>
        </div>
        <div className="flex items-center justify-center bg-gradient-to-br from-emerald-900/40 to-zinc-900">
          <span className="text-lg">👟</span>
        </div>
        <div className="flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
          <span className="text-lg">👟</span>
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/stock-images",
    icon: "🖼️",
    label: "Stock Images",
    description: "Search millions of free stock photos and use them as creative backgrounds.",
    categories: ["All", "Images", "Most Popular"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-sky-900/40 to-zinc-900 flex items-center justify-center">
        <svg className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/stock-videos",
    icon: "🎥",
    label: "Stock Videos",
    description: "Search millions of free stock video clips for your ads and content.",
    badge: "New",
    categories: ["All", "Videos", "Most Popular"],
    preview: (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-sky-900/40 to-zinc-900 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <svg className="h-5 w-5 translate-x-0.5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/videos",
    icon: "🎬",
    label: "Video Ads",
    description: "Lip-synced UGC creator, storytelling, and showcase videos — AI scripts, voices, films, and cuts them; you edit any scene.",
    badge: "New",
    categories: ["All", "Videos", "Animation", "Most Popular"],
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
  {
    href: "/dashboard/generate/ad-copy#headlines",
    icon: "📰",
    label: "Headlines & CTAs",
    description: "Punchy, scroll-stopping headlines, primary text and call-to-actions — generated with your Ad Copy.",
    categories: ["All", "Text", "Most Popular"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-zinc-800 p-3">
        <div className="space-y-2">
          <div className="h-2.5 w-4/5 rounded bg-zinc-300" />
          <div className="h-2 w-3/5 rounded bg-zinc-500" />
        </div>
        <div className="mt-4 inline-flex rounded-full bg-amber-400 px-2 py-1 text-[9px] font-bold text-zinc-950">
          Shop Now →
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/videos",
    icon: "🛍️",
    label: "Product Videos",
    description: "Turn a product into a polished showcase video — AI writes, films and cuts it. Uses the Showcase style.",
    categories: ["All", "Videos", "Product Ads"],
    preview: (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-teal-900/50 to-zinc-900 flex items-center justify-center">
        <span className="text-3xl">🛍️</span>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 p-2">
          <div className="h-1 flex-1 rounded-full bg-white/20">
            <div className="h-1 w-1/3 rounded-full bg-teal-400" />
          </div>
          <span className="text-[8px] text-white/60">0:15</span>
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/creatives",
    icon: "✨",
    label: "Motion Effects",
    description: "Animate any static image creative into a ~5s video ad with a single click.",
    categories: ["All", "Videos", "Animation"],
    preview: (
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-fuchsia-900/40 to-zinc-900 flex items-center justify-center">
        <span className="text-3xl">✨</span>
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
          <svg className="h-3 w-3 translate-x-px text-zinc-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/product-photos?category=fashion",
    icon: "👗",
    label: "Fashion Photoshoots",
    description: "Put your product on AI models — on-figure fashion and lifestyle shots from a single photo.",
    badge: "New",
    categories: ["All", "Images", "Product Ads"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-pink-900/40 to-zinc-900 flex items-center justify-center">
        <span className="text-3xl">👗</span>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/batch",
    icon: "⚡",
    label: "Batch Generation",
    description: "One shared brief applied across every product you pick — each gets its own scored creative.",
    badge: "New",
    categories: ["All", "Images", "Product Ads"],
    preview: (
      <div className="grid h-full w-full grid-cols-3 gap-0.5 overflow-hidden rounded-lg bg-zinc-950">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-center bg-gradient-to-br from-amber-900/40 to-zinc-900">
            <span className="text-sm">⚡</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    href: "/dashboard/generate/image-studio",
    icon: "🧪",
    label: "Image Studio",
    description: "Generate variations, swap backgrounds, or edit any image with a text instruction.",
    badge: "New",
    categories: ["All", "Images"],
    preview: (
      <div className="grid h-full w-full grid-cols-3 gap-0.5 overflow-hidden rounded-lg bg-zinc-950">
        <div className="flex items-center justify-center bg-gradient-to-br from-cyan-900/50 to-zinc-900"><span className="text-sm">🔀</span></div>
        <div className="flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-zinc-900"><span className="text-sm">🖼️</span></div>
        <div className="flex items-center justify-center bg-gradient-to-br from-emerald-900/50 to-zinc-900"><span className="text-sm">✏️</span></div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/audio",
    icon: "🎙️",
    label: "Voiceover & Audio",
    description: "AI voiceovers (incl. Arabic dialects), background music and sound effects for your videos.",
    badge: "New",
    categories: ["All", "Audio", "Voice"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-900/50 to-zinc-900 flex items-center justify-center gap-1">
        {["h-4", "h-8", "h-5", "h-10", "h-6", "h-9", "h-4"].map((h, i) => (
          <div key={i} className={`w-1 rounded-full bg-indigo-400/70 ${h}`} />
        ))}
      </div>
    ),
  },
  {
    href: "/dashboard/generate/calendar",
    icon: "🗓️",
    label: "Marketing Calendar",
    description: "Plan campaigns around Ramadan, Eid, Black Friday, back-to-school and more — a prioritized seasonal calendar for your product.",
    badge: "New",
    categories: ["All", "Text", "Audience"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-amber-900/40 to-zinc-900 p-3">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className={`h-3 rounded-sm ${[3, 4, 10, 17].includes(i) ? "bg-amber-400/80" : "bg-zinc-700/60"}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className="text-sm">🌙</span>
          <div className="h-1.5 flex-1 rounded-full bg-amber-400/40" />
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/brand-safety",
    icon: "🛡️",
    label: "Brand Safety Check",
    description: "Scan copy for off-voice phrasing, risky claims, ad-policy issues, and cultural sensitivity before you ship it.",
    badge: "New",
    categories: ["All", "Text"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-emerald-900/40 to-zinc-900 flex items-center justify-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    href: "/dashboard/generate/funnel",
    icon: "🫙",
    label: "Funnel Designer",
    description: "Turn one product into a staged TOFU → MOFU → BOFU journey with a Morocco/COD-aware conversion playbook.",
    badge: "New",
    categories: ["All", "Text", "Audience"],
    preview: (
      <div className="h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-900/40 to-zinc-900 flex flex-col items-center justify-center gap-1.5 p-4">
        <div className="h-3 w-full rounded-sm bg-sky-400/70" />
        <div className="h-3 w-2/3 rounded-sm bg-violet-400/70" />
        <div className="h-3 w-1/3 rounded-sm bg-emerald-400/80" />
      </div>
    ),
  },
];

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: requestedCategory } = await searchParams;
  const cat = CATEGORIES.includes(requestedCategory as Category)
    ? (requestedCategory as Category)
    : "Most Popular";

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_35%),linear-gradient(180deg,rgba(24,24,27,0.95),rgba(9,9,11,0.98))] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Generate workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Create images, videos, copy, and audience intelligence in one place.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Start from a brand, choose a workflow, and keep every generation inside the same project context.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[28rem]">
              {[
                ["Brand-aware", "Always uses your saved brand kits"],
                ["Fast start", "Most workflows open in one click"],
                ["Background jobs", "Keep working while renders run"],
                ["Versioned", "Every output stays reusable"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3">
                  <div className="text-sm font-semibold text-zinc-50">{title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/dashboard/generate?cat=${encodeURIComponent(c)}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                cat === c
                  ? "border-amber-400 bg-amber-400/10 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}>
              {c}
            </Link>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Quick start</h2>
              <p className="mt-1 text-sm text-zinc-400">Jump into the highest-frequency workflows.</p>
            </div>
            <Link href="/dashboard/assistant" className="text-sm text-amber-300 hover:text-amber-200">
              Ask assistant →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["New campaign", "/dashboard/campaigns/new", "From brief to launch"],
              ["Product ads", "/dashboard/generate/product-ads", "Lifestyle shots, CTA, and export"],
              ["Voice", "/dashboard/generate/voice", "Voiceovers, narration, and cloning"],
              ["Animation", "/dashboard/generate/animation", "Turn stills into motion clips"],
            ].map(([title, href, text]) => (
              <Link key={title} href={href as string} className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 hover:border-white/20">
                <div className="text-sm font-semibold text-zinc-50">{title}</div>
                <div className="mt-1 text-xs text-zinc-500">{text}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Asset grid */}
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.filter((asset) =>
            cat === "Most Popular"
              ? asset.categories.includes("All") || asset.categories.includes("Most Popular")
              : asset.categories.includes(cat),
          ).map((a) => (
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
