"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { and, eq, or, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { generateStrategy } from "@/lib/ai/strategist";
import { inngest } from "@/inngest/client";
import { generateObject } from "ai";
import { z } from "zod";
import { copywriterModel } from "@/lib/ai/models";
import { scoreCreative } from "@/lib/ai/creative-scorer";

function clean(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

export async function generateStandaloneCreatives(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const productName = clean(formData, "productName");
  const textMode = clean(formData, "textMode") ?? "ai";

  // "ai" mode requires a goal; "manual" mode requires a headline
  const goal = clean(formData, "goal");
  const headline = clean(formData, "headline");

  if (!productName) {
    redirect(
      "/dashboard/creatives/new?error=" +
        encodeURIComponent("Product name is required"),
    );
  }
  if (textMode === "ai" && !goal) {
    redirect(
      "/dashboard/creatives/new?error=" +
        encodeURIComponent("Creative goal is required"),
    );
  }
  if (textMode === "manual" && !headline) {
    redirect(
      "/dashboard/creatives/new?error=" +
        encodeURIComponent("Headline is required in manual mode"),
    );
  }

  const campaignId = clean(formData, "campaignId");
  if (campaignId) {
    const [camp] = await db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(
        and(
          eq(schema.campaigns.id, campaignId),
          eq(schema.campaigns.orgId, org.id),
        ),
      )
      .limit(1);
    if (!camp) {
      redirect(
        "/dashboard/creatives/new?error=" +
          encodeURIComponent("Campaign not found"),
      );
    }
  }

  const selectedProductId = clean(formData, "productId");
  const brandProfileId = clean(formData, "brandProfileId");
  const photoSource = clean(formData, "photoSource") ?? "ai";
  const photoUrl = clean(formData, "photoUrl");

  // AI Compose mode: multiple reference images are blended by the model.
  const isCompose = clean(formData, "composeMode") === "ai-compose";
  const scenePromptInput = clean(formData, "scenePrompt") ?? "";
  const referenceImages: string[] = (() => {
    if (!isCompose) return [];
    const raw = clean(formData, "referenceImages");
    if (!raw) return [];
    try {
      const a = JSON.parse(raw) as unknown;
      return Array.isArray(a)
        ? (a as unknown[]).filter((u): u is string => typeof u === "string" && !!u)
        : [];
    } catch { return []; }
  })();
  // Fields stored in creative meta depend on visual mode.
  const visualMeta = isCompose
    ? { composeMode: "ai-compose" as const, referenceImages }
    : { photoSource, photoUrl };
  // For compose mode, the prompt frames an integrated shot around the scene.
  // Each variant keeps its own scene (or its own angle when the user pinned a
  // scene), so AI copy variants don't all collapse onto one identical image.
  function buildComposePrompt(scene: string, angle?: string | null): string {
    if (!isCompose) return scene;
    const subject = productName ? `the ${productName}` : "the product";
    return [
      `Combine the supplied reference images into one photorealistic advertising photo: ` +
        `the person naturally using or wearing ${subject}, preserving its exact appearance.`,
      `Scene: ${scenePromptInput.length >= 3 ? scenePromptInput : scene}.`,
      scenePromptInput.length >= 3 && angle ? `Creative angle: ${angle}.` : null,
      `Editorial lifestyle photography, soft natural lighting, clean negative space for text overlay.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  let count = 0;
  try {
    // Resolve the product: reuse the selected catalog product, or create a new
    // one (tied to the brand so it joins the catalog).
    let product: typeof schema.products.$inferSelect | undefined;

    if (selectedProductId) {
      const [existing] = await db
        .select()
        .from(schema.products)
        .where(
          and(
            eq(schema.products.id, selectedProductId),
            eq(schema.products.orgId, org.id),
          ),
        )
        .limit(1);
      if (existing) {
        // Refresh the catalog product's brand visuals from the selected brand;
        // keep its stored product photo (per-generation photo lives on the
        // creative, not the product).
        const prevBrand = (existing.brand ?? {}) as Record<string, unknown>;
        [product] = await db
          .update(schema.products)
          .set({
            description: clean(formData, "productDescription") ?? existing.description,
            targetAudience: clean(formData, "audience") ?? existing.targetAudience,
            brand: {
              ...prevBrand,
              primaryColor: clean(formData, "brandColor"),
              accentColor: clean(formData, "accentColor"),
              logoUrl: clean(formData, "logoUrl"),
            },
          })
          .where(eq(schema.products.id, existing.id))
          .returning();
      }
    }

    if (!product) {
      [product] = await db
        .insert(schema.products)
        .values({
          orgId: org.id,
          brandProfileId: brandProfileId ?? null,
          name: productName!,
          description: clean(formData, "productDescription"),
          targetAudience: clean(formData, "audience"),
          brand: {
            primaryColor: clean(formData, "brandColor"),
            accentColor: clean(formData, "accentColor"),
            logoUrl: clean(formData, "logoUrl"),
            photoUrl,
          },
        })
        .returning();
    }

    const templatePref = clean(formData, "templatePref");

    if (textMode === "manual") {
      // User wrote their own copy — create 1 creative directly, no AI strategy needed.
      const primaryText = clean(formData, "primaryText");
      const callToAction = clean(formData, "callToAction");
      const template =
        templatePref && templatePref !== "auto" ? templatePref : "overlay";

      // Build a background image generation prompt from the available context.
      // The headline/CTA is overlaid by the design system — fal.ai only renders
      // the scene behind the copy.
      const bgPromptParts: string[] = [];
      bgPromptParts.push(
        clean(formData, "productDescription")
          ? `${productName}: ${clean(formData, "productDescription")}`
          : productName!,
      );
      bgPromptParts.push("advertising background scene");
      const brandColor = clean(formData, "brandColor");
      if (brandColor) bgPromptParts.push(`dominant color: ${brandColor}`);
      bgPromptParts.push("professional commercial photography, clean composition, lifestyle aesthetic");

      const [creative] = await db
        .insert(schema.creatives)
        .values({
          orgId: org.id,
          productId: product.id,
          campaignId: campaignId ?? null,
          type: "image",
          status: "pending",
          prompt: buildComposePrompt(bgPromptParts.join(", ")),
          meta: {
            concept: productName,
            template,
            headline,
            primaryText,
            callToAction,
            imageModel: clean(formData, "imageModel") ?? "nano-banana-2",
            ...visualMeta,
          },
        })
        .returning();

      await inngest.send({
        name: "creative/generate.requested",
        data: { creativeId: creative.id },
      });
      count = 1;
    } else {
      // Pull the selected brand's voice (tone + description) so the AI copy is
      // written in-brand — not just visually branded by color/logo.
      let brandTone: string | null = null;
      let brandDescription: string | null = null;
      let brandName: string | null = null;
      if (brandProfileId) {
        const [bp] = await db
          .select({
            name: schema.brandProfiles.name,
            tone: schema.brandProfiles.tone,
            description: schema.brandProfiles.description,
          })
          .from(schema.brandProfiles)
          .where(
            and(
              eq(schema.brandProfiles.id, brandProfileId),
              eq(schema.brandProfiles.orgId, org.id),
            ),
          )
          .limit(1);
        if (bp) {
          brandName = bp.name;
          brandTone = bp.tone;
          brandDescription = bp.description;
        }
      }

      // AI generates 2–4 creative variants from the brief.
      const strategy = await generateStrategy(
        {
          productName: productName!,
          productDescription: clean(formData, "productDescription"),
          goal: goal!,
          audience: clean(formData, "audience"),
          tone: brandTone,
          brandName,
          brandDescription,
          brandColor: clean(formData, "brandColor"),
          language: clean(formData, "language"),
          dialect: clean(formData, "dialect"),
        },
        null,
      );

      for (const concept of strategy.creatives) {
        const template =
          templatePref && templatePref !== "auto" ? templatePref : concept.template;

        const [creative] = await db
          .insert(schema.creatives)
          .values({
            orgId: org.id,
            productId: product.id,
            campaignId: campaignId ?? null,
            type: concept.type,
            status: "pending",
            prompt: buildComposePrompt(concept.creativePrompt, concept.concept),
            meta: {
              concept: concept.concept,
              template,
              headline: concept.headline,
              primaryText: concept.primaryText,
              callToAction: concept.callToAction,
              imageModel: clean(formData, "imageModel") ?? "nano-banana-2",
              ...visualMeta,
            },
          })
          .returning();

        await inngest.send({
          name: "creative/generate.requested",
          data: { creativeId: creative.id },
        });
        count++;
      }
    }
  } catch (err) {
    redirect(
      "/dashboard/creatives/new?error=" +
        encodeURIComponent(
          `Generation failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
    );
  }

  revalidatePath("/dashboard/creatives");
  redirect(`/dashboard/creatives?generated=${count}`);
}

type ProductBrand = { photoUrl?: string | null };

export async function regenerateCreative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const useOriginalPhoto = formData.get("useOriginalPhoto") === "1";

  const [creative] = await db
    .select({ id: schema.creatives.id, productId: schema.creatives.productId })
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, id), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) return;

  if (useOriginalPhoto && creative.productId) {
    // Skip AI — use the product's uploaded photo directly as the background.
    const [product] = await db
      .select({ brand: schema.products.brand })
      .from(schema.products)
      .where(eq(schema.products.id, creative.productId))
      .limit(1);
    const photoUrl = ((product?.brand ?? {}) as ProductBrand).photoUrl ?? null;

    await db
      .update(schema.creatives)
      .set({ status: "ready", assetUrl: photoUrl, provider: "photo" })
      .where(eq(schema.creatives.id, id));

    revalidatePath("/dashboard/creatives");
    return;
  }

  await db
    .update(schema.creatives)
    .set({ status: "pending", assetUrl: null })
    .where(eq(schema.creatives.id, id));

  const imageModel = clean(formData, "imageModel");
  await inngest.send({
    name: "creative/generate.requested",
    data: { creativeId: id, ...(imageModel ? { imageModel } : {}) },
  });

  revalidatePath("/dashboard/creatives");
}

export async function retryStuckCreatives(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  // Accept explicit IDs submitted as repeated "ids" fields, or fall back to
  // retrying every stuck creative for the org.
  const rawIds = formData.getAll("ids").map((v) => String(v)).filter(Boolean);

  let ids: string[];
  if (rawIds.length > 0) {
    // Verify ownership — only retry creatives that actually belong to this org.
    const owned = await db
      .select({ id: schema.creatives.id })
      .from(schema.creatives)
      .where(
        and(
          eq(schema.creatives.orgId, org.id),
          inArray(schema.creatives.id, rawIds),
        ),
      );
    ids = owned.map((c) => c.id);
  } else {
    const stuck = await db
      .select({ id: schema.creatives.id })
      .from(schema.creatives)
      .where(
        and(
          eq(schema.creatives.orgId, org.id),
          or(
            eq(schema.creatives.status, "pending"),
            eq(schema.creatives.status, "generating"),
          ),
        ),
      );
    ids = stuck.map((c) => c.id);
  }

  if (ids.length === 0) {
    revalidatePath("/dashboard/creatives");
    redirect("/dashboard/creatives");
  }

  await db
    .update(schema.creatives)
    .set({ status: "pending", assetUrl: null })
    .where(
      and(
        eq(schema.creatives.orgId, org.id),
        inArray(schema.creatives.id, ids),
      ),
    );

  for (const id of ids) {
    await inngest.send({
      name: "creative/generate.requested",
      data: { creativeId: id },
    });
  }

  revalidatePath("/dashboard/creatives");
  redirect(`/dashboard/creatives?generated=${ids.length}`);
}

const TARGET_SCORE = 90;
const MAX_REFINE_ITERATIONS = 4;

const COPYWRITER_SYSTEM =
  "You are a world-class direct-response ad copywriter. Rewrite ad copy so it scores " +
  `${TARGET_SCORE}+ on this exact rubric an AI scorer uses:\n\n` +
  "  • Hook strength — the first 3 words must stop a scroll cold\n" +
  "  • Specificity — concrete numbers, claims, and details (never vague adjectives)\n" +
  "  • Benefit / emotional appeal — hit a real desire or pain the customer feels\n" +
  "  • Clarity — one sharp idea, grasped in under 3 seconds\n" +
  "  • CTA strength — urgent and low-risk\n\n" +
  "Fully rewrite — do not lightly tweak. Aim for genuinely exceptional copy that nails " +
  "every dimension. When given the previous attempt's score and feedback, fix exactly " +
  "what held it back and push higher.\n\n" +
  "HARD CHARACTER LIMITS — count before you output:\n" +
  "  • headline: ≤40 characters (spaces included)\n" +
  "  • primaryText: ≤90 characters (spaces included)\n" +
  "Never exceed them. Never cut mid-word.";

// Word-boundary truncation — a hard slice would cut mid-word and tank the score.
function wordTrim(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return (cut > 0 ? t.slice(0, cut) : t.slice(0, max)).trim();
}

/**
 * Clone a creative with AI-improved copy, iteratively refined to hit a high
 * conversion score. Each pass rewrites the copy, scores it, and feeds the score
 * back into the next rewrite — keeping the best version and stopping early once
 * it clears the target. The achieved score is baked in so it shows immediately.
 */
export async function applyScoreTips(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { org } = await ensureProfile(user);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, id), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) return;

  const meta = (creative.meta ?? {}) as Record<string, unknown>;
  const callToAction = (meta.callToAction as string | null) ?? "Shop Now";
  const concept = (meta.concept as string | null) ?? null;

  // Seed the loop with the current copy + its existing score/feedback.
  let curHeadline  = (meta.headline    as string | null) ?? "";
  let curPrimary   = (meta.primaryText as string | null) ?? "";
  let curTips      = Array.isArray(meta.scoreTips) ? (meta.scoreTips as string[]) : [];
  let curScore     = typeof meta.score === "number" ? (meta.score as number) : null;
  let curRationale = (meta.scoreRationale as string | null) ?? null;

  let best: {
    headline: string; primaryText: string;
    score: number; rationale: string; tips: string[];
    predictedCtrBand: string; conversionLikelihood: string;
  } | null = null;

  for (let i = 0; i < MAX_REFINE_ITERATIONS; i++) {
    // No .max() in schema — Zod rejects slightly-over-limit output and throws.
    // wordTrim enforces the limits after generation instead.
    const { object } = await generateObject({
      model: copywriterModel,
      schema: z.object({
        headline:    z.string().describe("Improved headline, ≤40 chars"),
        primaryText: z.string().describe("Improved punchline/body, ≤90 chars"),
      }),
      system: COPYWRITER_SYSTEM,
      prompt: [
        `Current headline: "${curHeadline}"`,
        curPrimary ? `Current primary text: "${curPrimary}"` : "(no primary text yet — write one)",
        `CTA: "${callToAction}"`,
        curScore !== null ? `\nThe previous version scored ${curScore}/100.` : null,
        curRationale ? `Main weakness: ${curRationale}` : null,
        curTips.length ? "Fix these specifically:" : null,
        ...curTips.map((t, n) => `  ${n + 1}. ${t}`),
        `\nRewrite to score ${TARGET_SCORE}+ on the rubric. Both fields required.`,
      ].filter(Boolean).join("\n"),
    });

    const headline    = wordTrim(object.headline,    40);
    const primaryText = wordTrim(object.primaryText, 90);

    const scored = await scoreCreative({
      concept,
      headline,
      primaryText,
      callToAction,
      type: creative.type,
    });

    if (!best || scored.score > best.score) {
      best = {
        headline,
        primaryText,
        score: scored.score,
        rationale: scored.rationale,
        tips: scored.tips,
        predictedCtrBand: scored.predictedCtrBand,
        conversionLikelihood: scored.conversionLikelihood,
      };
    }
    if (scored.score >= TARGET_SCORE) break;

    // Feed this attempt's result back into the next rewrite.
    curHeadline  = headline;
    curPrimary   = primaryText;
    curTips      = scored.tips;
    curScore     = scored.score;
    curRationale = scored.rationale;
  }

  if (!best) return;

  // Clone with the best copy + its fresh score already baked in (preScored ⇒
  // the generation job won't re-score and undo the gain).
  const { score: _s, scoreRationale: _r, scoreTips: _t, ...restMeta } = meta;
  void _s; void _r; void _t;

  const [newCreative] = await db
    .insert(schema.creatives)
    .values({
      orgId:      org.id,
      productId:  creative.productId,
      campaignId: creative.campaignId,
      type:       creative.type,
      status:     "pending",
      prompt:     creative.prompt,
      meta: {
        ...restMeta,
        headline:       best.headline,
        primaryText:    best.primaryText,
        score:          best.score,
        scoreRationale: best.rationale,
        scoreTips:      best.tips,
        predictedCtrBand: best.predictedCtrBand,
        conversionLikelihood: best.conversionLikelihood,
      },
    })
    .returning();

  try {
    await inngest.send({
      name: "creative/generate.requested",
      data: {
        creativeId: newCreative.id,
        imageModel: meta.imageModel as string | undefined,
        preScored: true,
      },
    });
  } catch (err) {
    console.error("[apply-score-tips] inngest.send failed:", err);
  }

  revalidatePath("/dashboard/creatives");
}

/**
 * Animate a ready image creative into a ~5s video ad: clones the row as
 * type "video" pointing at the source's scene image, then the normal
 * generation job runs it through the image-to-video model. Copy carries over
 * (Meta video ads keep headline/text as ad fields around the clip).
 */
export async function animateCreative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const id = clean(formData, "creativeId");
  if (!id) return;

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, id), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative || creative.type === "video") return;
  if (creative.status !== "ready" || !creative.assetUrl) {
    redirect(
      "/dashboard/creatives?error=" +
        encodeURIComponent("Wait for the image to finish generating before animating."),
    );
  }

  const meta = (creative.meta ?? {}) as Record<string, unknown>;
  const { score: _s, scoreRationale: _r, scoreTips: _t, ...restMeta } = meta;
  void _s; void _r; void _t;

  const [videoCreative] = await db
    .insert(schema.creatives)
    .values({
      orgId: org.id,
      productId: creative.productId,
      campaignId: creative.campaignId,
      type: "video",
      status: "pending",
      prompt:
        `Bring this ad scene to life with subtle cinematic motion — gentle camera ` +
        `push-in, natural ambient movement, the subject stays sharp. Scene: ${creative.prompt ?? ""}`.slice(0, 800),
      meta: {
        ...restMeta,
        // The source's generated scene (public fal URL) is what gets animated.
        photoSource: "upload",
        photoUrl: creative.assetUrl,
        sourceCreativeId: creative.id,
      },
    })
    .returning();

  try {
    await inngest.send({
      name: "creative/generate.requested",
      data: { creativeId: videoCreative.id },
    });
  } catch (err) {
    console.error("[animate] inngest.send failed:", err);
  }

  revalidatePath("/dashboard/creatives");
  redirect("/dashboard/creatives?generated=1");
}

export async function assignCreativeToCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const creativeId = clean(formData, "creativeId");
  if (!creativeId) return;

  const [creative] = await db
    .select({ id: schema.creatives.id })
    .from(schema.creatives)
    .where(
      and(
        eq(schema.creatives.id, creativeId),
        eq(schema.creatives.orgId, org.id),
      ),
    )
    .limit(1);
  if (!creative) return;

  const campaignId = clean(formData, "campaignId");

  await db
    .update(schema.creatives)
    .set({ campaignId: campaignId ?? null })
    .where(eq(schema.creatives.id, creativeId));

  revalidatePath("/dashboard/creatives");
}

/** Replace a creative's tags (freeform, stored in meta.tags — no schema migration needed). */
export async function updateCreativeTags(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const creativeId = clean(formData, "creativeId");
  if (!creativeId) return;

  const [creative] = await db
    .select({ id: schema.creatives.id, meta: schema.creatives.meta })
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, creativeId), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) return;

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  const meta = (creative.meta ?? {}) as Record<string, unknown>;
  await db
    .update(schema.creatives)
    .set({ meta: { ...meta, tags } })
    .where(eq(schema.creatives.id, creativeId));

  revalidatePath("/dashboard/creatives");
}
