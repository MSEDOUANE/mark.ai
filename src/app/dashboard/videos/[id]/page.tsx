import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { AutoRefresh } from "../../campaigns/[id]/auto-refresh";
import {
  updateScene,
  regenerateScene,
  rerenderProject,
  deleteScene,
  moveScene,
  deleteVideoProject,
} from "../actions";
import type { VideoScript } from "@/lib/ai/video-script";

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

export default async function VideoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { id } = await params;

  const [project] = await db
    .select()
    .from(schema.videoProjects)
    .where(
      and(eq(schema.videoProjects.id, id), eq(schema.videoProjects.orgId, org.id)),
    )
    .limit(1);
  if (!project) redirect("/dashboard/videos");

  const script = project.script as VideoScript;
  const scenes = script?.scenes ?? [];
  const rendering = project.status === "rendering";

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <AutoRefresh enabled={rendering} intervalMs={5000} />
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/videos" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Video Studio
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <p className="mt-0.5 text-sm capitalize text-zinc-400">
              {project.style} · {project.language === "fr" ? "Français" : "English"} · {project.voice} voice
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!rendering && scenes.length > 0 ? (
              <form action={rerenderProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
                  Re-render final video
                </button>
              </form>
            ) : null}
            <form action={deleteVideoProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-red-400/40 hover:text-red-300">
                Delete
              </button>
            </form>
          </div>
        </div>

        {/* Status */}
        {rendering ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-950/20 px-4 py-3">
            <svg className="h-4 w-4 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-amber-200">
              Rendering — writing script, filming scenes, recording voiceover,
              cutting the final video. This page refreshes automatically.
            </p>
          </div>
        ) : null}
        {project.status === "failed" && project.error ? (
          <p className="mt-5 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {project.error}
          </p>
        ) : null}

        {/* Final video */}
        {project.finalUrl ? (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Final video</h2>
              <a href={project.finalUrl} download
                className="text-sm text-amber-400 hover:underline">
                Download
              </a>
            </div>
            <video src={project.finalUrl} controls playsInline
              className="mt-4 max-h-[480px] w-full rounded-xl bg-black" />
          </section>
        ) : null}

        {/* Scene editor */}
        {scenes.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Scenes</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Adjust any scene — visuals, motion, voiceover, length — then
              regenerate it, and re-render the final cut.
            </p>
            <div className="mt-4 space-y-4">
              {scenes.map((scene, i) => (
                <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-300">
                      Scene {i + 1}
                      <span className="ml-2 text-xs font-normal text-zinc-600">
                        {scene.videoUrl ? "clip ready" : scene.imageUrl ? "still ready — clip pending" : "not rendered yet"}
                      </span>
                    </p>
                    <div className="flex items-center gap-1">
                      <form action={moveScene}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="index" value={i} />
                        <input type="hidden" name="dir" value="up" />
                        <button disabled={i === 0} className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30">↑</button>
                      </form>
                      <form action={moveScene}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="index" value={i} />
                        <input type="hidden" name="dir" value="down" />
                        <button disabled={i === scenes.length - 1} className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30">↓</button>
                      </form>
                      {scenes.length > 2 ? (
                        <form action={deleteScene}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="index" value={i} />
                          <button className="rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-800 hover:text-red-300">✕</button>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
                    {/* Preview */}
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                      {scene.videoUrl ? (
                        <video src={scene.videoUrl} controls loop muted playsInline className="aspect-square w-full object-cover" />
                      ) : scene.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center text-3xl text-zinc-700">🎬</div>
                      )}
                    </div>

                    {/* Editable fields */}
                    <form action={updateScene} className="space-y-3">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="index" value={i} />
                      <label className="block text-xs text-zinc-500">
                        Visual (what the viewer sees)
                        <textarea name="visual" rows={2} defaultValue={scene.visual} className={`mt-1 ${field}`} />
                      </label>
                      <label className="block text-xs text-zinc-500">
                        Motion (camera / subject movement)
                        <input name="motion" defaultValue={scene.motion} className={`mt-1 ${field}`} />
                      </label>
                      <label className="block text-xs text-zinc-500">
                        Voiceover line
                        <textarea name="voiceover" rows={2} defaultValue={scene.voiceover} className={`mt-1 ${field}`} />
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs text-zinc-500">
                          Length
                          <select name="durationSeconds" defaultValue={String(scene.durationSeconds)} className={`mt-1 ${field}`}>
                            <option value="5">5s</option>
                            <option value="10">10s</option>
                          </select>
                        </label>
                        <button className="mt-4 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700">
                          Save changes
                        </button>
                      </div>
                    </form>
                  </div>

                  {!rendering ? (
                    <form action={regenerateScene} className="mt-3">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="index" value={i} />
                      <button className="rounded-lg bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-400/20">
                        ↻ Regenerate this scene
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-600">
              Hook: “{script.hook}” · CTA: “{script.ctaLine}” — edits to scene
              text apply on the next render; changing visuals/motion/length
              clears that scene&apos;s clip so it re-films.
            </p>
          </section>
        ) : !rendering ? (
          <p className="mt-8 text-sm text-zinc-500">
            No script yet — hit “Re-render final video” to generate one.
          </p>
        ) : null}
      </div>
    </main>
  );
}
