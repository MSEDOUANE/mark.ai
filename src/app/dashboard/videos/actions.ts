"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import type { VideoScript, VideoScriptInput } from "@/lib/ai/video-script";
import { reviseVideoScript } from "@/lib/ai/video-script";

function clean(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

async function requireOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  return { user, org };
}

async function ownedProject(id: string, orgId: string) {
  const [project] = await db
    .select()
    .from(schema.videoProjects)
    .where(
      and(eq(schema.videoProjects.id, id), eq(schema.videoProjects.orgId, orgId)),
    )
    .limit(1);
  return project;
}

async function enqueueRender(
  projectId: string,
  resetScenes?: number[],
  scriptInput?: Partial<VideoScriptInput>,
) {
  await db
    .update(schema.videoProjects)
    .set({ status: "rendering", error: null, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  try {
    await inngest.send({
      name: "video/render.requested",
      data: {
        projectId,
        ...(resetScenes?.length ? { resetScenes } : {}),
        ...(scriptInput ? { scriptInput } : {}),
      },
    });
  } catch (err) {
    console.error("[videos] enqueue failed:", err);
    await db
      .update(schema.videoProjects)
      .set({
        status: "failed",
        error: "Job runner offline — start the Inngest dev server and retry.",
        updatedAt: new Date(),
      })
      .where(eq(schema.videoProjects.id, projectId));
  }
}

/** Create a project from a catalog product + style and start rendering. */
export async function createVideoProject(formData: FormData) {
  const { org } = await requireOrg();

  const productId = clean(formData, "productId");
  const style = clean(formData, "style") ?? "ugc";
  const language = clean(formData, "language") ?? "en";
  const dialect = clean(formData, "dialect");
  const voice = clean(formData, "voice") ?? "female";
  const avatar = clean(formData, "avatar");
  const objective = clean(formData, "objective");
  const creativePrompt = clean(formData, "creativePrompt");
  const keyPoints = clean(formData, "keyPoints");
  const cta = clean(formData, "cta");
  const mustAvoid = clean(formData, "mustAvoid");
  const sceneCountRaw = Number(formData.get("sceneCount"));
  const sceneCount =
    Number.isInteger(sceneCountRaw) && sceneCountRaw >= 2 && sceneCountRaw <= 5
      ? sceneCountRaw
      : 3;
  // User-uploaded avatar photo (data URI from /api/upload-asset). Only kept
  // for the avatar style; drives the custom-avatar (Kling AI Avatar) path.
  const avatarImageUrl = clean(formData, "avatarImageUrl");
  const musicPrompt = clean(formData, "musicPrompt");

  let product: typeof schema.products.$inferSelect | undefined;
  if (productId) {
    [product] = await db
      .select()
      .from(schema.products)
      .where(
        and(eq(schema.products.id, productId), eq(schema.products.orgId, org.id)),
      )
      .limit(1);
  }
  const title = clean(formData, "title") ?? product?.name;
  if (!title) {
    redirect("/dashboard/videos?error=" + encodeURIComponent("Pick a product or give the video a title."));
  }

  const [project] = await db
    .insert(schema.videoProjects)
    .values({
      orgId: org.id,
      productId: product?.id ?? null,
      brandProfileId: product?.brandProfileId ?? null,
      title: title!,
      style,
      language,
      dialect: language === "ar" ? dialect : null,
      voice,
      avatar: style === "avatar" ? avatar : null,
      avatarImageUrl: style === "avatar" ? avatarImageUrl : null,
      musicPrompt,
    })
    .returning();

  await enqueueRender(project.id, undefined, {
    objective,
    userPrompt: creativePrompt,
    keyPoints,
    callToAction: cta,
    mustAvoid,
    sceneCount,
  });
  redirect(`/dashboard/videos/${project.id}`);
}

/** Save the user's edits to one scene (text fields only — no re-render). */
export async function updateScene(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const index = Number(formData.get("index"));
  if (!projectId || !Number.isInteger(index)) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  const script = project.script as VideoScript;
  const scene = script.scenes?.[index];
  if (!scene) return;

  const visual = clean(formData, "visual");
  const motion = clean(formData, "motion");
  const voiceover = clean(formData, "voiceover");
  const duration = Number(formData.get("durationSeconds"));

  if (visual && visual !== scene.visual) {
    scene.visual = visual;
    // Changed visuals invalidate this scene's rendered assets.
    scene.imageUrl = null;
    scene.videoUrl = null;
  }
  if (motion && motion !== scene.motion) {
    scene.motion = motion;
    scene.videoUrl = null;
  }
  if (voiceover) scene.voiceover = voiceover;
  if (duration === 5 || duration === 10) {
    if (duration !== scene.durationSeconds) scene.videoUrl = null;
    scene.durationSeconds = duration;
  }

  await db
    .update(schema.videoProjects)
    .set({ script, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  revalidatePath(`/dashboard/videos/${projectId}`);
}

/** Regenerate one scene's visuals from its current prompts. */
export async function regenerateScene(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const index = Number(formData.get("index"));
  if (!projectId || !Number.isInteger(index)) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  await enqueueRender(projectId, [index]);
  revalidatePath(`/dashboard/videos/${projectId}`);
}

/** Re-render: fills any missing scene clips, re-voices, re-assembles. */
export async function rerenderProject(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  if (!projectId) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  await enqueueRender(projectId);
  revalidatePath(`/dashboard/videos/${projectId}`);
}

export async function deleteScene(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const index = Number(formData.get("index"));
  if (!projectId || !Number.isInteger(index)) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  const script = project.script as VideoScript;
  if (!script.scenes || script.scenes.length <= 2) return; // keep ≥2 scenes
  script.scenes.splice(index, 1);

  await db
    .update(schema.videoProjects)
    .set({ script, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  revalidatePath(`/dashboard/videos/${projectId}`);
}

export async function moveScene(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const index = Number(formData.get("index"));
  const dir = clean(formData, "dir") === "up" ? -1 : 1;
  if (!projectId || !Number.isInteger(index)) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  const script = project.script as VideoScript;
  const target = index + dir;
  if (!script.scenes?.[index] || !script.scenes[target]) return;
  [script.scenes[index], script.scenes[target]] = [
    script.scenes[target],
    script.scenes[index],
  ];

  await db
    .update(schema.videoProjects)
    .set({ script, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  revalidatePath(`/dashboard/videos/${projectId}`);
}

/** Loads brand name/tone for a project's brand profile, if any (for revision context). */
async function brandContextFor(project: typeof schema.videoProjects.$inferSelect) {
  if (!project.brandProfileId) return { brandName: null, tone: null };
  const [brand] = await db
    .select({ name: schema.brandProfiles.name, tone: schema.brandProfiles.tone })
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.id, project.brandProfileId))
    .limit(1);
  return { brandName: brand?.name ?? null, tone: brand?.tone ?? null };
}

/**
 * Refine the WHOLE video from free-text feedback: snapshot the current script
 * to history, have the AI rewrite it incorporating the feedback, and save the
 * new script. Deliberately does NOT auto re-render — the user reviews the new
 * scenes/voiceover in the editor, then hits "Re-render" (saves fal credits).
 * The revised script carries no scene asset URLs, so a re-render re-films
 * every scene from the new visuals.
 */
export async function refineVideoScript(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const feedback = clean(formData, "feedback");
  if (!projectId) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;
  if (!feedback) {
    redirect(`/dashboard/videos/${projectId}?error=` + encodeURIComponent("Add some feedback to refine the video."));
  }

  const current = project.script as VideoScript;
  if (!current?.scenes?.length) {
    redirect(`/dashboard/videos/${projectId}?error=` + encodeURIComponent("No script to refine yet — render one first."));
  }

  const { brandName, tone } = await brandContextFor(project);

  let revised: VideoScript;
  try {
    revised = await reviseVideoScript({
      current,
      feedback: feedback!,
      style: project.style,
      language: project.language,
      dialect: project.dialect,
      brandName,
      tone,
    });
  } catch (err) {
    console.error("[videos] refine failed:", err);
    redirect(`/dashboard/videos/${projectId}?error=` + encodeURIComponent("Couldn't revise the script — try again."));
  }

  // Snapshot the pre-revision script (with the feedback that superseded it),
  // then overwrite. Best-effort history — never block the revision on it.
  try {
    await db.insert(schema.videoScriptHistory).values({
      videoProjectId: projectId,
      orgId: org.id,
      snapshot: current,
      feedback: feedback!,
    });
  } catch (err) {
    console.error("[videos] script-history snapshot failed:", err);
  }

  await db
    .update(schema.videoProjects)
    .set({ script: revised!, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  revalidatePath(`/dashboard/videos/${projectId}`);
  redirect(`/dashboard/videos/${projectId}?revised=1`);
}

/**
 * Restore a past script version. Snapshots the CURRENT script first (symmetric
 * / reversible, feedback=null since it wasn't feedback-driven), then swaps in
 * the chosen snapshot. Doesn't auto re-render — the user reviews and renders.
 */
export async function restoreVideoScriptVersion(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  const historyId = clean(formData, "historyId");
  if (!projectId || !historyId) return;
  const project = await ownedProject(projectId, org.id);
  if (!project) return;

  const [entry] = await db
    .select()
    .from(schema.videoScriptHistory)
    .where(
      and(
        eq(schema.videoScriptHistory.id, historyId),
        eq(schema.videoScriptHistory.videoProjectId, projectId),
        eq(schema.videoScriptHistory.orgId, org.id),
      ),
    )
    .limit(1);
  if (!entry) return;

  try {
    await db.insert(schema.videoScriptHistory).values({
      videoProjectId: projectId,
      orgId: org.id,
      snapshot: project.script,
      feedback: null,
    });
  } catch (err) {
    console.error("[videos] pre-restore snapshot failed:", err);
  }

  await db
    .update(schema.videoProjects)
    .set({ script: entry.snapshot as VideoScript, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  revalidatePath(`/dashboard/videos/${projectId}`);
  redirect(`/dashboard/videos/${projectId}?restored=1`);
}

export async function deleteVideoProject(formData: FormData) {
  const { org } = await requireOrg();
  const projectId = clean(formData, "projectId");
  if (!projectId) return;
  await db
    .delete(schema.videoProjects)
    .where(
      and(
        eq(schema.videoProjects.id, projectId),
        eq(schema.videoProjects.orgId, org.id),
      ),
    );
  revalidatePath("/dashboard/videos");
  redirect("/dashboard/videos");
}
