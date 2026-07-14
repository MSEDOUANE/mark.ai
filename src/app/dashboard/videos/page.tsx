import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { createVideoProject } from "./actions";
import { AVATARS, VOICE_LANGUAGES } from "@/lib/creative/image-models/fal-audio-video";
import { AvatarPicker } from "./avatar-picker";

const field =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

const STYLES = [
  { id: "avatar", icon: "🎤", label: "UGC Avatar", desc: "Real lip-synced creator presents your product to camera" },
  { id: "ugc", icon: "🤳", label: "UGC B-roll", desc: "Authentic selfie-feel scenes with voiceover" },
  { id: "storytelling", icon: "🎬", label: "Storytelling", desc: "Problem → discovery → transformation arc" },
  { id: "showcase", icon: "✨", label: "Showcase", desc: "Premium editorial product film" },
];

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-emerald-400/15 text-emerald-300",
  rendering: "bg-amber-400/15 text-amber-300",
  failed: "bg-red-400/15 text-red-300",
  draft: "bg-zinc-700/40 text-zinc-400",
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error } = await searchParams;

  const [projects, products] = await Promise.all([
    db
      .select()
      .from(schema.videoProjects)
      .where(eq(schema.videoProjects.orgId, org.id))
      .orderBy(desc(schema.videoProjects.createdAt)),
    db
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.orgId, org.id),
          isNotNull(schema.products.brandProfileId),
        ),
      )
      .orderBy(desc(schema.products.createdAt)),
  ]);

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold">Video Studio</h1>
        <p className="mt-1 text-sm text-zinc-400">
          AI writes the script, films each scene, adds the voiceover, and cuts
          the final video — then you adjust any scene and re-render.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          {/* New video form */}
          <form
            action={createVideoProject}
            className="h-fit space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <h2 className="text-lg font-semibold">New video</h2>

            {products.length > 0 ? (
              <label className="block text-sm">
                <span className="text-zinc-400">Product</span>
                <select name="productId" className={`mt-1.5 ${field}`} defaultValue={products[0]?.id ?? ""}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-sm">
                <span className="text-zinc-400">Title / product *</span>
                <input name="title" placeholder="Reveria Signature Collection" className={`mt-1.5 ${field}`} />
              </label>
            )}

            <div className="text-sm">
              <span className="text-zinc-400">Style</span>
              <div className="mt-1.5 space-y-2">
                {STYLES.map((s, i) => (
                  <label key={s.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-950/25 has-[:checked]:ring-1 has-[:checked]:ring-amber-400">
                    <input type="radio" name="style" value={s.id} defaultChecked={i === 0} className="sr-only" />
                    <span className="text-xl">{s.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-100">{s.label}</span>
                      <span className="block text-xs text-zinc-500">{s.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <AvatarPicker presets={AVATARS} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="text-zinc-400">Voiceover language</span>
                <select name="language" className={`mt-1.5 ${field}`} defaultValue="en">
                  {VOICE_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-zinc-400">Voice</span>
                <select name="voice" className={`mt-1.5 ${field}`} defaultValue="female">
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
            </div>

            <button className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              Generate video →
            </button>
            <p className="text-xs text-zinc-600">
              Script in your brand voice · ~3 scenes · voiceover · final cut in
              a few minutes.
            </p>
          </form>

          {/* Project list */}
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
                No videos yet — pick a product and a style to make your first one.
              </div>
            ) : (
              projects.map((p) => (
                <Link key={p.id} href={`/dashboard/videos/${p.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-600">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 text-xl">
                    {p.status === "ready" && p.finalUrl ? "🎥" : STYLES.find((s) => s.id === p.style)?.icon ?? "🎥"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="text-xs capitalize text-zinc-500">
                      {p.style} · {p.language === "fr" ? "Français" : "English"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}>
                    {p.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
