import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

type Kind = "image" | "video" | "text" | "page";

interface AssetItem {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  thumbUrl: string | null;
  href: string;
  createdAt: Date;
}

const KIND_LABEL: Record<Kind, { label: string; icon: string }> = {
  image: { label: "Images", icon: "🎨" },
  video: { label: "Videos", icon: "🎬" },
  text: { label: "Text", icon: "✍️" },
  page: { label: "Pages", icon: "🌐" },
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { kind: kindFilter } = await searchParams;

  const [creativeRows, generationRows, videoRows, pageRows] = await Promise.all([
    db
      .select({
        id: schema.creatives.id,
        type: schema.creatives.type,
        assetUrl: schema.creatives.assetUrl,
        meta: schema.creatives.meta,
        createdAt: schema.creatives.createdAt,
      })
      .from(schema.creatives)
      .where(eq(schema.creatives.orgId, org.id))
      .orderBy(desc(schema.creatives.createdAt))
      .limit(100),

    db
      .select({
        id: schema.generations.id,
        tool: schema.generations.tool,
        input: schema.generations.input,
        createdAt: schema.generations.createdAt,
      })
      .from(schema.generations)
      .where(eq(schema.generations.orgId, org.id))
      .orderBy(desc(schema.generations.createdAt))
      .limit(100),

    db
      .select({
        id: schema.videoProjects.id,
        title: schema.videoProjects.title,
        status: schema.videoProjects.status,
        finalUrl: schema.videoProjects.finalUrl,
        createdAt: schema.videoProjects.createdAt,
      })
      .from(schema.videoProjects)
      .where(eq(schema.videoProjects.orgId, org.id))
      .orderBy(desc(schema.videoProjects.createdAt))
      .limit(100),

    db
      .select({
        id: schema.landingPages.id,
        slug: schema.landingPages.slug,
        title: schema.landingPages.title,
        createdAt: schema.landingPages.createdAt,
      })
      .from(schema.landingPages)
      .where(eq(schema.landingPages.orgId, org.id))
      .orderBy(desc(schema.landingPages.createdAt))
      .limit(100),
  ]);

  const items: AssetItem[] = [
    ...creativeRows
      .filter((c) => c.assetUrl)
      .map((c): AssetItem => {
        const meta = (c.meta ?? {}) as Record<string, unknown>;
        return {
          id: c.id,
          kind: c.type === "video" ? "video" : "image",
          title: (meta.headline as string) || (meta.concept as string) || "Ad creative",
          subtitle: (meta.primaryText as string) ?? "",
          thumbUrl: c.type === "image" ? `/api/creatives/${c.id}?size=square&thumb=1` : c.assetUrl,
          href: "/dashboard/creatives",
          createdAt: c.createdAt,
        };
      }),
    ...generationRows.map((g): AssetItem => {
      const input = (g.input ?? {}) as Record<string, unknown>;
      return {
        id: g.id,
        kind: "text",
        title: (input.productName as string) || g.tool,
        subtitle: g.tool.replace(/-/g, " "),
        thumbUrl: null,
        href: `/dashboard/generate/${g.tool}`,
        createdAt: g.createdAt,
      };
    }),
    ...videoRows
      .filter((v) => v.finalUrl)
      .map((v): AssetItem => ({
        id: v.id,
        kind: "video",
        title: v.title,
        subtitle: "Video Studio",
        thumbUrl: v.finalUrl,
        href: `/dashboard/videos/${v.id}`,
        createdAt: v.createdAt,
      })),
    ...pageRows.map((p): AssetItem => ({
      id: p.id,
      kind: "page",
      title: p.title,
      subtitle: `/p/${p.slug}`,
      thumbUrl: null,
      href: `/p/${p.slug}`,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const counts = (["image", "video", "text", "page"] as Kind[]).reduce(
    (acc, k) => ({ ...acc, [k]: items.filter((i) => i.kind === k).length }),
    {} as Record<Kind, number>,
  );

  const filtered = kindFilter && kindFilter in KIND_LABEL
    ? items.filter((i) => i.kind === kindFilter)
    : items;

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Asset Library</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            Every creative, video, generated text, and page — all in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/library"
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              !kindFilter ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}>
            All <span className="text-zinc-600">{items.length}</span>
          </Link>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <Link key={k} href={`/dashboard/library?kind=${k}`}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                kindFilter === k ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}>
              {KIND_LABEL[k].icon} {KIND_LABEL[k].label} <span className="text-zinc-600">{counts[k]}</span>
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-3xl">🗂️</p>
            <p className="mt-3 text-sm text-zinc-500">Nothing here yet — generate something in Generate or Videos.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href}
                className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600">
                <div className="relative aspect-square overflow-hidden bg-zinc-950">
                  {item.thumbUrl ? (
                    item.kind === "video" ? (
                      <video src={item.thumbUrl} muted className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbUrl} alt={item.title} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {KIND_LABEL[item.kind].icon}
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    {KIND_LABEL[item.kind].label}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-zinc-200">{item.title}</p>
                  {item.subtitle && <p className="truncate text-[10px] text-zinc-500">{item.subtitle}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
