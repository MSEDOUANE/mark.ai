"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { strategistModel } from "@/lib/ai/models";
import { readBrandContext, saveGeneration } from "@/lib/ai/tool-context";
import { languageDirective } from "@/lib/ai/languages";

// ── Planner (Claude) ─────────────────────────────────────────────────────────

const postIdeaSchema = z.object({
  theme: z.string().describe("Short label for the post's angle, e.g. 'Behind the scenes'"),
  caption: z.string().describe("Full ready-to-post caption in the brand voice and output language"),
  hashtags: z.array(z.string()).min(3).max(8).describe("Relevant hashtags, without the # if you prefer, this UI adds context"),
  suggestedDay: z.string().describe("Which day to post, e.g. 'Monday' or 'Day 1'"),
  bestTime: z.string().describe("Suggested local time to post, e.g. '19:00'"),
  format: z.string().describe("Post format, e.g. 'single image', 'carousel', 'reel'"),
  rationale: z.string().describe("One line on why this post/slot works"),
});

const plannerSchema = z.object({
  strategy: z.string().describe("One paragraph on the content approach for this period"),
  ideas: z.array(postIdeaSchema).min(3).max(8),
});

export type PostIdea = z.infer<typeof postIdeaSchema>;
export type PlannerResult = z.infer<typeof plannerSchema>;

export type PlannerState =
  | { status: "idle" }
  | { status: "success"; result: PlannerResult }
  | { status: "error"; message: string };

export async function planContent(
  _prev: PlannerState,
  formData: FormData,
): Promise<PlannerState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  function field(key: string) {
    const v = String(formData.get(key) ?? "").trim();
    return v || null;
  }

  const productName = field("productName");
  if (!productName) return { status: "error", message: "Product name is required." };

  const brand = readBrandContext(formData);
  const language = field("language") ?? "ar";
  const dialect = field("dialect");
  const count = Math.min(Math.max(Number(field("count") ?? 5) || 5, 3), 8);

  const prompt = [
    languageDirective(language, dialect),
    ...brand.lines,
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("goal") && `Content goal: ${field("goal")}`,
    `\nPlan ${count} organic social posts for this brand — a mix of angles (value, social proof, behind-the-scenes, offer, engagement).`,
    `Each post needs a ready-to-publish caption in the brand voice, hashtags, a suggested day and local time, a format, and a one-line rationale.`,
    `Spread the posts across a week so it reads like a real content calendar, not ${count} variations of one post.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: plannerSchema,
      system:
        "You are a social media manager who plans organic content calendars that build audience and drive sales " +
        "without being salesy every post. Every caption is publish-ready and on-brand.",
      prompt,
    });

    await saveGeneration({
      orgId: org.id,
      tool: "content-planner",
      brandProfileId: brand.brandProfileId,
      input: { productName, description: field("description"), goal: field("goal"), count, language, dialect },
      output: object,
    });

    return { status: "success", result: object };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Planning failed",
    };
  }
}

// ── Queue (DB) ───────────────────────────────────────────────────────────────

async function currentOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org, profile } = await ensureProfile(user);
  return { org, profile };
}

/** Create a queued post. `when` is a datetime-local string; `mode` = schedule|draft. */
export async function schedulePost(formData: FormData) {
  const { org, profile } = await currentOrg();

  const caption = String(formData.get("caption") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const when = String(formData.get("scheduledFor") ?? "").trim();
  const brandProfileId = String(formData.get("brandProfileId") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "schedule");

  if (!caption) {
    redirect("/dashboard/generate/scheduler?error=" + encodeURIComponent("A caption is required."));
  }

  // Drafts can be timeless; scheduled posts need a future time.
  let scheduledFor = new Date();
  if (mode === "schedule") {
    const parsed = when ? new Date(when) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      redirect("/dashboard/generate/scheduler?error=" + encodeURIComponent("Pick a valid date and time to schedule."));
    } else if (parsed.getTime() < Date.now()) {
      redirect("/dashboard/generate/scheduler?error=" + encodeURIComponent("Scheduled time must be in the future."));
    } else {
      scheduledFor = parsed;
    }
  } else if (when) {
    const parsed = new Date(when);
    if (!Number.isNaN(parsed.getTime())) scheduledFor = parsed;
  }

  await db.insert(schema.scheduledPosts).values({
    orgId: org.id,
    brandProfileId,
    caption,
    imageUrl,
    scheduledFor,
    status: mode === "draft" ? "draft" : "scheduled",
    createdBy: profile.id,
  });

  revalidatePath("/dashboard/generate/scheduler");
  redirect("/dashboard/generate/scheduler?info=" + encodeURIComponent(mode === "draft" ? "Saved as draft." : "Post scheduled."));
}

/** Cancel a queued post the user owns — offers an "Undo" right after via restoreScheduledPost. */
export async function cancelScheduledPost(formData: FormData) {
  const { org } = await currentOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(schema.scheduledPosts)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(and(eq(schema.scheduledPosts.id, id), eq(schema.scheduledPosts.orgId, org.id)));

  revalidatePath("/dashboard/generate/scheduler");
  redirect(`/dashboard/generate/scheduler?undoId=${encodeURIComponent(id)}`);
}

/**
 * Restores a canceled post. If its scheduled time already passed while
 * canceled, restores to "draft" instead of "scheduled" so it doesn't
 * immediately fire on the next processor tick with a stale time — the user
 * picks a fresh time and re-schedules explicitly.
 */
export async function restoreScheduledPost(formData: FormData) {
  const { org } = await currentOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [post] = await db
    .select({ scheduledFor: schema.scheduledPosts.scheduledFor, status: schema.scheduledPosts.status })
    .from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.id, id), eq(schema.scheduledPosts.orgId, org.id)))
    .limit(1);
  if (!post || post.status !== "canceled") {
    revalidatePath("/dashboard/generate/scheduler");
    return;
  }

  const stillFuture = post.scheduledFor.getTime() > Date.now();
  await db
    .update(schema.scheduledPosts)
    .set({ status: stillFuture ? "scheduled" : "draft", updatedAt: new Date() })
    .where(and(eq(schema.scheduledPosts.id, id), eq(schema.scheduledPosts.orgId, org.id)));

  revalidatePath("/dashboard/generate/scheduler");
  redirect("/dashboard/generate/scheduler");
}
