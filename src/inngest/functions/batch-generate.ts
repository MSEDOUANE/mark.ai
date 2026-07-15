import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { copywriterModel } from "@/lib/ai/models";

const batchConceptSchema = z.object({
  concept: z.string().describe("One-line creative angle for this product"),
  template: z.enum(["overlay", "split", "bold"]),
  headline: z.string().describe("≤40 characters"),
  primaryText: z.string().describe("≤110 characters"),
  callToAction: z.string().describe("≤25 characters, e.g. 'Shop Now'"),
  creativePrompt: z.string().describe("Background image generation prompt — the scene behind the copy, no text in the image itself"),
});

/**
 * Batch Generation: one shared brief × N products → N scored creatives.
 * Each product gets its own AI-written copy (step-isolated so a single
 * product's failure doesn't take down the batch) then fans into the
 * existing single-creative pipeline (creative/generate.requested) —
 * no duplicated image-generation logic.
 */
export const batchGenerateCreatives = inngest.createFunction(
  {
    id: "batch-generate-creatives",
    name: "Batch generate creatives",
    retries: 1,
    triggers: [{ event: "creative/batch.requested" }],
  },
  async ({ event, step }) => {
    const orgId = event.data.orgId as string;
    const productIds = event.data.productIds as string[];
    const brief = event.data.brief as string;
    const goal = (event.data.goal as string | null) ?? null;

    const results: Array<{ productId: string; creativeId?: string; error?: string }> = [];

    for (const productId of productIds) {
      try {
        const [product] = await step.run(`load-product-${productId}`, () =>
          db.select().from(schema.products).where(eq(schema.products.id, productId)).limit(1),
        );
        if (!product) {
          results.push({ productId, error: "Product not found" });
          continue;
        }

        const brand = (product.brand ?? {}) as {
          logoUrl?: string | null; primaryColor?: string | null; accentColor?: string | null; photoUrl?: string | null;
        };

        const { object: concept } = await step.run(`copy-${productId}`, () =>
          generateObject({
            model: copywriterModel,
            schema: batchConceptSchema,
            system:
              "You are a senior direct-response copywriter. Write one punchy ad concept for this " +
              "specific product, following the shared campaign brief. Be concrete and specific, " +
              "never generic.",
            prompt: [
              `Shared brief: ${brief}`,
              goal && `Goal: ${goal}`,
              `Product: ${product.name}`,
              product.description && `Description: ${product.description}`,
              product.targetAudience && `Audience: ${product.targetAudience}`,
            ].filter(Boolean).join("\n"),
          }),
        );

        const [creative] = await step.run(`insert-${productId}`, () =>
          db
            .insert(schema.creatives)
            .values({
              orgId,
              productId: product.id,
              type: "image",
              status: "pending",
              prompt: concept.creativePrompt,
              meta: {
                concept: concept.concept,
                template: concept.template,
                headline: concept.headline,
                primaryText: concept.primaryText,
                callToAction: concept.callToAction,
                imageModel: "nano-banana-2",
                ...(brand.photoUrl ? { photoSource: "upload", photoUrl: brand.photoUrl } : { photoSource: "ai" }),
                batchTag: "batch",
              },
            })
            .returning(),
        );

        await step.sendEvent(`enqueue-${productId}`, {
          name: "creative/generate.requested",
          data: { creativeId: creative.id },
        });

        results.push({ productId, creativeId: creative.id });
      } catch (err) {
        results.push({ productId, error: err instanceof Error ? err.message.slice(0, 200) : "Failed" });
      }
    }

    return { total: productIds.length, succeeded: results.filter((r) => r.creativeId).length, results };
  },
);
