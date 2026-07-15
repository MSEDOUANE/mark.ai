import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import {
  CREATIVE_SIZES,
  creativeArtwork,
  loadBrandFonts,
  type CreativeArtworkOptions,
  type CreativeBrand,
  type CreativeTemplate,
  type PlacedImage,
} from "@/lib/creative/design";

type CreativeMeta = {
  concept?: string;
  template?: CreativeTemplate;
  headline?: string;
  primaryText?: string;
  callToAction?: string;
  brand?: CreativeBrand;
  placedImages?: PlacedImage[];
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const sizeKey  = url.searchParams.get("size") ?? "portrait";
  const download = url.searchParams.get("download") === "1";
  const thumb    = url.searchParams.get("thumb") === "1" && !download;
  const { w, h } = CREATIVE_SIZES[sizeKey] ?? CREATIVE_SIZES.portrait;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { org } = await ensureProfile(user);

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, id), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) return new Response("Not found", { status: 404 });

  const meta = (creative.meta ?? {}) as CreativeMeta;

  // Brand from associated product (if any), merged with any inline meta.brand.
  let brand: CreativeBrand = {};
  let defaultTemplate: CreativeTemplate | null = null;
  if (creative.productId) {
    const [product] = await db
      .select({ brand: schema.products.brand, brandProfileId: schema.products.brandProfileId })
      .from(schema.products)
      .where(eq(schema.products.id, creative.productId))
      .limit(1);
    brand = (product?.brand ?? {}) as CreativeBrand;

    // Brand Kit v2 fields (font, secondary color, default template) live on
    // the brand profile, not the per-product snapshot — fill gaps only, the
    // product snapshot and meta.brand below still win for logo/primary/accent.
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
  // Composer-mode creatives store brand inline in meta; merge (meta wins).
  if (meta.brand) {
    brand = { ...brand, ...meta.brand };
  }

  const bgImageUrl = creative.status === "ready" ? creative.assetUrl : null;

  const artworkOpts: CreativeArtworkOptions = {
    headline: meta.headline,
    primaryText: meta.primaryText,
    callToAction: meta.callToAction,
    concept: meta.concept,
    template: meta.template ?? defaultTemplate ?? "overlay",
    brand,
    bgImageUrl,
    placedImages: meta.placedImages,
  };

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    // Browser caches for 1 hour; serves stale for another 24 h while revalidating.
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
  };

  if (download) {
    const slug = (meta.headline ?? meta.concept ?? "creative")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    headers["Content-Disposition"] = `attachment; filename="${slug}-${sizeKey}.png"`;
    // Downloads must not be served from cache.
    headers["Cache-Control"] = "no-store";
  }

  // Suppress unused variable warning — thumb is read from URL for future use.
  void thumb;

  // Render to bytes so satori failures are catchable (ImageResponse streams
  // lazily — errors would surface as an opaque 500 after headers are sent).
  // A broken image (corrupt logo/photo) degrades to a text-only design
  // instead of taking the whole creative down.
  const fontText = [meta.headline, meta.primaryText, meta.callToAction].filter(Boolean).join(" ");
  const fonts = await loadBrandFonts(brand.fontFamily, fontText);

  try {
    const png = await new ImageResponse(creativeArtwork(artworkOpts, sizeKey).element, {
      width: w,
      height: h,
      ...(fonts.length ? { fonts } : {}),
    }).arrayBuffer();
    return new Response(png, { headers });
  } catch (err) {
    console.error(`[creative-render] ${id} failed, retrying without images:`, err);
    const fallback = creativeArtwork(
      {
        ...artworkOpts,
        brand: { ...brand, logoUrl: null },
        bgImageUrl: null,
        placedImages: [],
      },
      sizeKey,
    );
    const png = await new ImageResponse(fallback.element, {
      width: w,
      height: h,
      ...(fonts.length ? { fonts } : {}),
    }).arrayBuffer();
    return new Response(png, { headers });
  }
}
