import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { CREATIVE_SIZES, creativeArtwork, loadBrandFonts } from "@/lib/creative/design";
import { resolveCreativeArtwork, type CreativeMeta } from "@/lib/creative/resolve-artwork";

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
  const artworkOpts = await resolveCreativeArtwork(creative);

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
  const fonts = await loadBrandFonts(artworkOpts.brand?.fontFamily, fontText);

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
        brand: { ...artworkOpts.brand, logoUrl: null },
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
