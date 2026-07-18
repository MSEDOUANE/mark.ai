import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { FavoriteButton, FolderPicker } from "./library-item-controls";

type Kind = "image" | "video" | "text" | "page";

interface AssetItem {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  thumbUrl: string | null;
  href: string;
  createdAt: Date;
  favorite: boolean;
  folder: string | null;
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
  searchParams: Promise<{ kind?: string; q?: string; folder?: string; fav?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { kind: kindFilter, q, folder: folderFilter, fav } = await searchParams;
  const favOnly = fav === "1";

  const [creativeRows, generationRows, videoRows, pageRows, metaRows] = await Promise.all([
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

    db
      .select({
        kind: schema.libraryItemMeta.kind,
        itemId: schema.libraryItemMeta.itemId,
        favorite: schema.libraryItemMeta.favorite,
        folder: schema.libraryItemMeta.folder,
      })
      .from(schema.libraryItemMeta)
      .where(eq(schema.libraryItemMeta.orgId, org.id)),
  ]);

  const metaByKey = new Map(
    metaRows.map((m) => [`${m.kind}:${m.itemId}`, { favorite: m.favorite, folder: m.folder }]),
  );
  function lookupMeta(kind: Kind, id: string) {
    return metaByKey.get(`${kind}:${id}`) ?? { favorite: false, folder: null };
  }

  const items: AssetItem[] = [
    ...creativeRows
      .filter((c) => c.assetUrl)
      .map((c): AssetItem => {
        const meta = (c.meta ?? {}) as Record<string, unknown>;
        const kind: Kind = c.type === "video" ? "video" : "image";
        return {
          id: c.id,
          kind,
          title: (meta.headline as string) || (meta.concept as string) || "Ad creative",
          subtitle: (meta.primaryText as string) ?? "",
          thumbUrl: c.type === "image" ? `/api/creatives/${c.id}?size=square&thumb=1` : c.assetUrl,
          href: "/dashboard/creatives",
          createdAt: c.createdAt,
          ...lookupMeta(kind, c.id),
        };
      }),
    ...generationRows.map((g): AssetItem => ({
      id: g.id,
      kind: "text",
      title: (((g.input ?? {}) as Record<string, unknown>).productName as string) || g.tool,
      subtitle: g.tool.replace(/-/g, " "),
      thumbUrl: null,
      href: `/dashboard/generate/${g.tool}`,
      createdAt: g.createdAt,
      ...lookupMeta("text", g.id),
    })),
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
        ...lookupMeta("video", v.id),
      })),
    ...pageRows.map((p): AssetItem => ({
      id: p.id,
      kind: "page",
      title: p.title,
      subtitle: `/p/${p.slug}`,
      thumbUrl: null,
      href: `/p/${p.slug}`,
      createdAt: p.createdAt,
      ...lookupMeta("page", p.id),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const counts = (["image", "video", "text", "page"] as Kind[]).reduce(
    (acc, k) => ({ ...acc, [k]: items.filter((i) => i.kind === k).length }),
    {} as Record<Kind, number>,
  );

  // Kind filter first (folders/search are scoped to whatever kind is active).
  const byKind = kindFilter && kindFilter in KIND_LABEL
    ? items.filter((i) => i.kind === kindFilter)
    : items;

  const knownFolders = Array.from(
    new Set(byKind.map((i) => i.folder).filter((f): f is string => !!f)),
  ).sort();

  const byFolder = folderFilter ? byKind.filter((i) => i.folder === folderFilter) : byKind;
  const byFav = favOnly ? byFolder.filter((i) => i.favorite) : byFolder;
  const needle = q?.trim().toLowerCase();
  const filtered = needle
    ? byFav.filter((i) => i.title.toLowerCase().includes(needle) || i.subtitle.toLowerCase().includes(needle))
    : byFav;

  // Preserve the active kind filter when submitting search / clicking chips.
  const kindQS = kindFilter ? `kind=${encodeURIComponent(kindFilter)}` : "";
  const withKind = (extra: string) => `/dashboard/library?${[kindQS, extra].filter(Boolean).join("&")}`;

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Asset Library</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Every creative, video, generated text, and page — all in one place.
            </p>
          </div>
          <form action="/dashboard/library" method="GET" className="flex items-center gap-2">
            {kindFilter && <input type="hidden" name="kind" value={kindFilter} />}
            {folderFilter && <input type="hidden" name="folder" value={folderFilter} />}
            {favOnly && <input type="hidden" name="fav" value="1" />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search title or copy…"
              className="w-56 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />
            <button type="submit" className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">
              Search
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <span className="mx-1 h-5 w-px bg-zinc-800" />
          <Link href={favOnly ? withKind("") : withKind("fav=1")}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              favOnly ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}>
            ★ Favorites <span className="text-zinc-600">{byKind.filter((i) => i.favorite).length}</span>
          </Link>
        </div>

        {knownFolders.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-600">Folders:</span>
            {knownFolders.map((f) => (
              <Link key={f} href={folderFilter === f ? withKind("") : withKind(`folder=${encodeURIComponent(f)}`)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  folderFilter === f ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                }`}>
                📁 {f}
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-3xl">🗂️</p>
            <p className="mt-3 text-sm text-zinc-500">
              {needle || folderFilter || favOnly
                ? "Nothing matches these filters."
                : "Nothing here yet — generate something in Generate or Videos."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((item) => (
              <div key={`${item.kind}-${item.id}`}
                className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600">
                <Link href={item.href} className="block">
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
                  <div className="p-2.5 pb-0">
                    <p className="truncate text-xs font-medium text-zinc-200">{item.title}</p>
                    {item.subtitle && <p className="truncate text-[10px] text-zinc-500">{item.subtitle}</p>}
                  </div>
                </Link>
                <div className="px-2.5 pb-2.5">
                  <FolderPicker kind={item.kind} itemId={item.id} folder={item.folder} knownFolders={knownFolders} />
                </div>
                <FavoriteButton kind={item.kind} itemId={item.id} favorite={item.favorite} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
