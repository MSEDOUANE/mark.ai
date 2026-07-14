"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import type { VideoScript } from "@/lib/ai/video-script";

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

async function enqueueRender(projectId: string, resetScenes?: number[]) {
  await db
    .update(schema.videoProjects)
    .set({ status: "rendering", error: null, updatedAt: new Date() })
    .where(eq(schema.videoProjects.id, projectId));
  try {
    await inngest.send({
      name: "video/render.requested",
      data: { projectId, ...(resetScenes?.length ? { resetScenes } : {}) },
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
  const voice = clean(formData, "voice") ?? "female";
  const avatar = clean(formData, "avatar");
  // User-uploaded avatar photo (data URI from /api/upload-asset). Only kept
  // for the avatar style; drives the OmniHuman custom-avatar path.
  const avatarImageUrl = clean(formData, "avatarImageUrl");

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
      voice,
      avatar: style === "avatar" ? avatar : null,
      avatarImageUrl: style === "avatar" ? avatarImageUrl : null,
    })
    .returning();

  await enqueueRender(project.id);
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
