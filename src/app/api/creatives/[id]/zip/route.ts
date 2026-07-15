import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { CREATIVE_SIZES, creativeArtwork, loadBrandFonts } from "@/lib/creative/design";
import { resolveCreativeArtwork, type CreativeMeta } from "@/lib/creative/resolve-artwork";
import { buildZip } from "@/lib/zip";

/** Bundles every CREATIVE_SIZES render of one creative into a single .zip download. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const fontText = [meta.headline, meta.primaryText, meta.callToAction].filter(Boolean).join(" ");
  const fonts = await loadBrandFonts(artworkOpts.brand?.fontFamily, fontText);

  const slug = (meta.headline ?? meta.concept ?? "creative")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40) || "creative";

  const entries = await Promise.all(
    Object.entries(CREATIVE_SIZES).map(async ([sizeKey, { w, h }]) => {
      const png = await new ImageResponse(creativeArtwork(artworkOpts, sizeKey).element, {
        width: w,
        height: h,
        ...(fonts.length ? { fonts } : {}),
      }).arrayBuffer();
      return { name: `${slug}-${sizeKey}.png`, data: new Uint8Array(png) };
    }),
  );

  const zip = buildZip(entries);

  return new Response(zip.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-all-sizes.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
