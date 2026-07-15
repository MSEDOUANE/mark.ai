import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { getCreativeProvider } from "@/lib/creative";
import { scoreCreative } from "@/lib/ai/creative-scorer";

type ProductBrand = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  photoUrl?: string | null;
};

/**
 * Background-image generation for a designed ad creative.
 *
 * Decision tree:
 *   1. Score the copy (always).
 *   2. FAL_KEY present + product photoUrl → FLUX Redux (img2img variation of the product photo).
 *   3. FAL_KEY present, no photoUrl       → FLUX Schnell (text-to-image from the prompt).
 *   4. No FAL_KEY + photoUrl              → use the product photo directly.
 *   5. Fallback                           → gradient-only design template.
 */
export const generateCreative = inngest.createFunction(
  {
    id: "generate-creative",
    name: "Generate creative",
    retries: 2,
    triggers: [{ event: "creative/generate.requested" }],
  },
  async ({ event, step }) => {
    const creativeId = event.data.creativeId as string;

    const [creative] = await db
      .select()
      .from(schema.creatives)
      .where(eq(schema.creatives.id, creativeId))
      .limit(1);
    if (!creative) throw new Error(`Creative ${creativeId} not found`);

    const meta = (creative.meta ?? {}) as Record<string, unknown>;

    // 1. Score copy — independent of image, stored immediately.
    //    Skip when the copy was already scored upstream (the "Apply
    //    recommendations" refine loop) — re-scoring would only add variance and
    //    could undo the gain the loop worked to achieve.
    const preScored =
      event.data.preScored === true && typeof meta.score === "number";

    if (preScored) {
      await db
        .update(schema.creatives)
        .set({ status: "generating" })
        .where(eq(schema.creatives.id, creativeId));
    } else {
      const score = await step.run("score", () =>
        scoreCreative({
          concept: meta.concept as string | undefined,
          headline: meta.headline as string | undefined,
          primaryText: meta.primaryText as string | undefined,
          callToAction: meta.callToAction as string | undefined,
          type: creative.type,
        }),
      );
      await db
        .update(schema.creatives)
        .set({
          status: "generating",
          meta: {
            ...meta,
            score: score.score,
            scoreRationale: score.rationale,
            scoreTips: score.tips,
            predictedCtrBand: score.predictedCtrBand,
            conversionLikelihood: score.conversionLikelihood,
          },
        })
        .where(eq(schema.creatives.id, creativeId));
    }

    // 2. Resolve the reference photo for this generation. The creative's own
    //    choice wins — photoSource "ai" forces a text-to-image scene — otherwise
    //    fall back to the product's stored photo (legacy creatives, or "use
    //    product image" selections).
    const metaPhotoSource = meta.photoSource as string | undefined;
    const metaPhotoUrl =
      typeof meta.photoUrl === "string" && meta.photoUrl ? meta.photoUrl : null;

    let photoUrl: string | null = null;
    if (metaPhotoSource === "ai") {
      photoUrl = null;
    } else if (metaPhotoUrl) {
      photoUrl = metaPhotoUrl;
    } else if (creative.productId) {
      const [product] = await db
        .select({ brand: schema.products.brand })
        .from(schema.products)
        .where(eq(schema.products.id, creative.productId))
        .limit(1);
      photoUrl = ((product?.brand ?? {}) as ProductBrand).photoUrl ?? null;
    }

    // Composer "AI Compose" mode: reference images (product + model) are fed
    // directly to the multi-image model to produce one integrated creative.
    const composeMode = meta.composeMode === "ai-compose";
    const referenceImages =
      composeMode && Array.isArray(meta.referenceImages)
        ? (meta.referenceImages as string[]).filter(Boolean)
        : [];

    // 3. Generate background image.
    let assetUrl: string | null = null;
    let usedProvider = "design-only";

    // Model: event data wins (per-regeneration override), then creative meta
    // (set at creation time), then default to nano-banana-2.
    const imageModel =
      (event.data.imageModel as string | undefined) ??
      (meta.imageModel as string | undefined) ??
      "nano-banana-2";

    if (process.env.FAL_KEY) {
      const result = await step.run("generate-background", async () => {
        try {
          const provider = getCreativeProvider();
          const mode = referenceImages.length
            ? `compose (${referenceImages.length} refs)`
            : photoUrl
            ? "Redux (img2img)"
            : `${imageModel} (text2img)`;
          console.log("[generate-creative]", mode, "| prompt:", (creative.prompt ?? "").slice(0, 60), "| ref:", photoUrl?.slice(0, 40) ?? "none");
          const job = await provider.submit({
            type: creative.type,
            prompt: creative.prompt ?? "",
            imageUrls: referenceImages.length ? referenceImages : undefined,
            imageUrl: photoUrl ?? undefined,
            imageModel,
          });
          if (job.status === "failed") {
            console.error("[generate-creative] provider failed:", job.error);
          } else {
            console.log("[generate-creative] success, assetUrl:", job.assetUrl?.slice(0, 60) ?? "(none)");
          }
          return job;
        } catch (err) {
          console.error("[generate-creative] provider threw:", err);
          return null;
        }
      });
      assetUrl = result?.assetUrl ?? null;
      usedProvider = assetUrl ? "fal" : "design-only";
    } else if (referenceImages.length) {
      // No AI key — fall back to the first reference image as the asset.
      assetUrl = referenceImages[0];
      usedProvider = "photo";
    } else if (photoUrl) {
      // No AI key — use the product photo directly as the background.
      assetUrl = photoUrl;
      usedProvider = "photo";
    }

    // 3. Persist result. Always marks ready — gradient is the fallback when
    //    assetUrl is null; a missing background is not a creative failure.
    await db
      .update(schema.creatives)
      .set({
        status: "ready",
        assetUrl,
        provider: usedProvider,
      })
      .where(eq(schema.creatives.id, creativeId));

    return { creativeId, status: "ready", hasBackground: !!assetUrl };
  },
);
