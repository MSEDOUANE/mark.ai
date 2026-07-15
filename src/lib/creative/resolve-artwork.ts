import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CreativeArtworkOptions, CreativeBrand, CreativeTemplate, PlacedImage } from "./design";

export type CreativeMeta = {
  concept?: string;
  template?: CreativeTemplate;
  headline?: string;
  primaryText?: string;
  callToAction?: string;
  brand?: CreativeBrand;
  placedImages?: PlacedImage[];
};

/**
 * Resolves a creative row into render-ready CreativeArtworkOptions: merges
 * brand data from the product snapshot, the product's brand profile (Brand
 * Kit v2 fields — font/secondary/accent/default template), and any inline
 * meta.brand override, in that precedence order (meta wins).
 *
 * Shared by the single-image render route and the "download all sizes" zip
 * route so both apply identical brand resolution.
 */
export async function resolveCreativeArtwork(
  creative: typeof schema.creatives.$inferSelect,
): Promise<CreativeArtworkOptions> {
  const meta = (creative.meta ?? {}) as CreativeMeta;

  let brand: CreativeBrand = {};
  let defaultTemplate: CreativeTemplate | null = null;
  if (creative.productId) {
    const [product] = await db
      .select({ brand: schema.products.brand, brandProfileId: schema.products.brandProfileId })
      .from(schema.products)
      .where(eq(schema.products.id, creative.productId))
      .limit(1);
    brand = (product?.brand ?? {}) as CreativeBrand;

    if (product?.brandProfileId) {
      const [bp] = await db
        .select({
          fontFamily: schema.brandProfiles.fontFamily,
          secondaryColor: schema.brandProfiles.secondaryColor,
          accentColor: schema.brandProfiles.accentColor,
          defaultTemplate: schema.brandProfiles.defaultTemplate,
        })
        .from(schema.brandProfiles)
        .where(eq(schema.brandProfiles.id, product.brandProfileId))
        .limit(1);
      if (bp) {
        brand = {
          fontFamily: brand.fontFamily ?? bp.fontFamily,
          secondaryColor: brand.secondaryColor ?? bp.secondaryColor,
          accentColor: brand.accentColor ?? bp.accentColor,
          ...brand,
        };
        defaultTemplate = (bp.defaultTemplate as CreativeTemplate | null) ?? null;
      }
    }
  }
  if (meta.brand) {
    brand = { ...brand, ...meta.brand };
  }

  const bgImageUrl = creative.status === "ready" ? creative.assetUrl : null;

  return {
    headline: meta.headline,
    primaryText: meta.primaryText,
    callToAction: meta.callToAction,
    concept: meta.concept,
    template: meta.template ?? defaultTemplate ?? "overlay",
    brand,
    bgImageUrl,
    placedImages: meta.placedImages,
  };
}
