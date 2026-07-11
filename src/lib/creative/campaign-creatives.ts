import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import type { Strategy } from "@/lib/ai/strategy-schema";

type Campaign = typeof schema.campaigns.$inferSelect;
type CreativeConcept = Strategy["creatives"][number];

/**
 * Insert creative rows for a campaign from strategist concepts and enqueue
 * their background generation — the single shared path for both the initial
 * campaign plan and later creative refreshes, so every campaign creative
 * carries the same explicit visual meta (photoSource/photoUrl/imageModel)
 * and never falls into legacy fallback rendering.
 */
export async function createCreativesForCampaign(
  campaign: Campaign,
  concepts: CreativeConcept[],
  extraMeta: Record<string, unknown> = {},
): Promise<string[]> {
  // Product photo → img2img variation; none → text2img scene.
  let productPhotoUrl: string | null = null;
  if (campaign.productId) {
    const [product] = await db
      .select({ brand: schema.products.brand })
      .from(schema.products)
      .where(eq(schema.products.id, campaign.productId))
      .limit(1);
    productPhotoUrl =
      ((product?.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null;
  }
  const visualMeta = productPhotoUrl
    ? { photoSource: "upload", photoUrl: productPhotoUrl }
    : { photoSource: "ai" };

  const ids: string[] = [];
  for (const concept of concepts) {
    const [creative] = await db
      .insert(schema.creatives)
      .values({
        orgId: campaign.orgId,
        productId: campaign.productId,
        campaignId: campaign.id,
        type: concept.type,
        status: "pending",
        prompt: concept.creativePrompt,
        meta: {
          concept: concept.concept,
          template: concept.template,
          headline: concept.headline,
          primaryText: concept.primaryText,
          callToAction: concept.callToAction,
          imageModel: "nano-banana-2",
          ...visualMeta,
          ...extraMeta,
        },
      })
      .returning();
    await inngest.send({
      name: "creative/generate.requested",
      data: { creativeId: creative.id },
    });
    ids.push(creative.id);
  }
  return ids;
}
