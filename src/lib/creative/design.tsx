import { ImageResponse } from "next/og";

export const CREATIVE_SIZES: Record<string, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  link: { w: 1200, h: 628 },
};

export type CreativeTemplate = "overlay" | "split" | "bold";

export type CreativeBrand = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
};

export type PlacementKey =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type PlacedImage = {
  url: string;
  placement: PlacementKey;
  label?: string;
  /** Multiplier for the default image size (default 1.0 = ~36% of shorter canvas side). */
  scale?: number;
};

export interface CreativeArtworkOptions {
  headline?: string | null;
  primaryText?: string | null;
  callToAction?: string | null;
  concept?: string | null;
  brand?: CreativeBrand | null;
  bgImageUrl?: string | null;
  template?: CreativeTemplate | null;
  placedImages?: PlacedImage[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Satori sizes `data:` URIs by magic bytes and only supports PNG / JPEG / GIF /
 * SVG — any other type (e.g. a WEBP logo stored via readAsDataURL) throws
 * "u2 is not iterable" mid-render and 500s the whole image. Remote URLs fail
 * gracefully inside satori, so only data URIs need gating.
 */
const OG_SAFE_DATA_URI = /^data:image\/(png|jpe?g|gif|svg\+xml)[;,]/i;

function ogSafeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return OG_SAFE_DATA_URI.test(url) ? url : null;
  return url;
}

interface TP {
  w: number;
  h: number;
  primary: string;
  accent: string;
  headline: string;
  body: string;
  cta: string;
  bgImage: string | null;
  logoUrl: string | null;
  placedImages: PlacedImage[];
}

function BgImage({ src, w, h }: { src: string; w: number; h: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={w} height={h} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

function Logo({ src, height, style }: { src: string; height: number; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" height={height} style={{ height, ...style }} />;
}

const PLACEMENT_MAP: Record<PlacementKey, { xKey: "left" | "center" | "right"; yKey: "top" | "middle" | "bottom" }> = {
  "top-left":      { xKey: "left",   yKey: "top" },
  "top-center":    { xKey: "center", yKey: "top" },
  "top-right":     { xKey: "right",  yKey: "top" },
  "center-left":   { xKey: "left",   yKey: "middle" },
  "center":        { xKey: "center", yKey: "middle" },
  "center-right":  { xKey: "right",  yKey: "middle" },
  "bottom-left":   { xKey: "left",   yKey: "bottom" },
  "bottom-center": { xKey: "center", yKey: "bottom" },
  "bottom-right":  { xKey: "right",  yKey: "bottom" },
};

function PlacedImagesLayer({ images, w, h }: { images: PlacedImage[]; w: number; h: number }) {
  if (!images.length) return null;
  const base = Math.round(Math.min(w, h) * 0.36);
  const margin = Math.round(Math.min(w, h) * 0.05);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      {images.map((img, idx) => {
        const s = Math.round(base * (img.scale ?? 1));
        const { xKey, yKey } = PLACEMENT_MAP[img.placement] ?? PLACEMENT_MAP["center"];
        const left = xKey === "left" ? margin : xKey === "right" ? w - s - margin : Math.round((w - s) / 2);
        const top  = yKey === "top"  ? margin : yKey === "bottom" ? h - s - margin : Math.round((h - s) / 2);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={idx} src={img.url} alt={img.label ?? ""} width={s} height={s}
            style={{ position: "absolute", left, top, width: s, height: s, objectFit: "contain" }} />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template: overlay
// Full-bleed background (image or gradient) with scrim, accent bar, text at bottom.
// ---------------------------------------------------------------------------
function overlayTemplate(p: TP): React.ReactElement {
  const { w, h, primary, accent, headline, body, cta, bgImage, logoUrl, placedImages } = p;
  const isLink = w > h;
  const pad = isLink ? 56 : 64;
  const hl = isLink ? 58 : 76;
  const bl = isLink ? 26 : 32;
  const cl = isLink ? 24 : 30;
  const lh = 64;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative", background: bgImage ? "#000" : `linear-gradient(145deg, ${primary} 0%, #0b0b12 90%)`, fontFamily: "Geist, sans-serif" }}>
      {bgImage ? <BgImage src={bgImage} w={w} h={h} /> : null}

      {/* Scrim — stronger at bottom for legibility */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.30) 52%, rgba(0,0,0,0.87) 100%)" }} />

      {/* Placed images — above scrim, below logo and text */}
      <PlacedImagesLayer images={placedImages} w={w} h={h} />

      {/* Logo */}
      {logoUrl ? <Logo src={logoUrl} height={lh} style={{ position: "absolute", top: pad, left: pad }} /> : null}

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", padding: pad, position: "relative" }}>
        <div style={{ width: 44, height: 4, background: accent, borderRadius: 2, marginBottom: 20 }} />
        <div style={{ color: "#fff", fontSize: hl, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: "88%" }}>
          {headline.slice(0, 60)}
        </div>
        {body ? (
          <div style={{ color: "rgba(255,255,255,0.82)", fontSize: bl, marginTop: 16, lineHeight: 1.45, maxWidth: "82%", display: "flex" }}>
            {body.slice(0, 120)}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 32, background: accent, color: "#0b0b12", fontSize: cl, fontWeight: 700, padding: "16px 36px", borderRadius: 999, alignSelf: "flex-start" }}>
          {cta}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template: split
// Two-panel editorial: image left / content right (square + portrait).
// For story (portrait-extreme) switches to top image / bottom content.
// ---------------------------------------------------------------------------
function splitTemplate(p: TP): React.ReactElement {
  const { w, h, primary, accent, headline, body, cta, bgImage, logoUrl, placedImages } = p;
  const isStory = h > w * 1.3;
  const isLink = w > h;

  if (isStory) {
    // Vertical split for story: image top 55%, content bottom
    const topH = Math.round(h * 0.54);
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: "Geist, sans-serif", position: "relative" }}>
        <div style={{ width: "100%", height: topH, display: "flex", position: "relative", background: bgImage ? "#000" : `linear-gradient(135deg, ${primary}cc 0%, ${primary} 100%)`, overflow: "hidden" }}>
          {bgImage ? <BgImage src={bgImage} w={w} h={topH} /> : null}
          {logoUrl ? <Logo src={logoUrl} height={52} style={{ position: "absolute", top: 52, left: 60 }} /> : null}
          {/* Fade into bottom panel color */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 160, background: `linear-gradient(180deg, transparent 0%, #0b0b12 100%)` }} />
        </div>
        {/* Placed images — after image panel, before text panel (overlays image area, text panel renders on top) */}
        <PlacedImagesLayer images={placedImages} w={w} h={h} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", background: "#0b0b12", padding: "56px 68px" }}>
          <div style={{ width: 40, height: 4, background: accent, borderRadius: 2, marginBottom: 24 }} />
          <div style={{ color: "#fff", fontSize: 66, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{headline.slice(0, 50)}</div>
          {body ? <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 30, marginTop: 16, lineHeight: 1.45, display: "flex" }}>{body.slice(0, 110)}</div> : null}
          <div style={{ display: "flex", marginTop: 40, background: accent, color: "#0b0b12", fontSize: 28, fontWeight: 700, padding: "18px 44px", borderRadius: 999, alignSelf: "flex-start" }}>{cta}</div>
        </div>
      </div>
    );
  }

  // Horizontal split for square, portrait, link
  const leftRatio = isLink ? 0.5 : 0.54;
  const leftW = Math.round(w * leftRatio);
  const rightW = w - leftW;
  const hl = isLink ? 50 : 60;
  const bl = isLink ? 24 : 28;
  const cl = isLink ? 22 : 26;
  const padR = isLink ? 48 : 52;
  const lh = isLink ? 44 : 52;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", fontFamily: "Geist, sans-serif", position: "relative" }}>
      {/* Left: image panel */}
      <div style={{ width: leftW, height: "100%", display: "flex", position: "relative", background: bgImage ? "#000" : `linear-gradient(160deg, ${primary}99 0%, ${primary} 100%)`, overflow: "hidden" }}>
        {bgImage ? <BgImage src={bgImage} w={leftW} h={h} /> : null}
        {/* Right-edge fade into content panel */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: "100%", background: "linear-gradient(90deg, transparent 0%, #0b0b12 100%)" }} />
        {/* Accent strip at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 6, background: accent }} />
      </div>

      {/* Placed images — after image panel, before text panel */}
      <PlacedImagesLayer images={placedImages} w={w} h={h} />

      {/* Right: content panel */}
      <div style={{ width: rightW, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#0b0b12", padding: `${padR}px` }}>
        {logoUrl ? <Logo src={logoUrl} height={lh} style={{ marginBottom: 28 }} /> : null}
        <div style={{ width: 36, height: 4, background: accent, borderRadius: 2, marginBottom: 18 }} />
        <div style={{ color: "#fff", fontSize: hl, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5 }}>{headline.slice(0, 55)}</div>
        {body ? <div style={{ color: "rgba(255,255,255,0.75)", fontSize: bl, marginTop: 14, lineHeight: 1.45, display: "flex" }}>{body.slice(0, 110)}</div> : null}
        <div style={{ display: "flex", marginTop: 32, background: accent, color: "#0b0b12", fontSize: cl, fontWeight: 700, padding: "14px 34px", borderRadius: 999, alignSelf: "flex-start" }}>{cta}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template: bold
// Maximum-impact centered headline on a gradient. Image used as faint texture.
// ---------------------------------------------------------------------------
function boldTemplate(p: TP): React.ReactElement {
  const { w, h, primary, accent, headline, body, cta, bgImage, logoUrl, placedImages } = p;
  const isLink = w > h;
  const hl = isLink ? 68 : 96;
  const bl = isLink ? 26 : 34;
  const cl = isLink ? 26 : 32;
  const lh = isLink ? 44 : 56;
  const padX = isLink ? 80 : 96;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", background: `linear-gradient(145deg, #0b0b12 0%, ${primary} 100%)`, fontFamily: "Geist, sans-serif" }}>
      {/* Image as very faint texture */}
      {bgImage ? (
        <>
          <BgImage src={bgImage} w={w} h={h} />
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: `linear-gradient(145deg, rgba(11,11,18,0.92) 0%, ${primary}dd 100%)` }} />
        </>
      ) : null}

      {/* Placed images — above overlay, below logo and text */}
      <PlacedImagesLayer images={placedImages} w={w} h={h} />

      {/* Logo pinned top-left */}
      {logoUrl ? <Logo src={logoUrl} height={lh} style={{ position: "absolute", top: 48, left: 56 }} /> : null}

      {/* Centered content */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `60px ${padX}px`, position: "relative", maxWidth: w }}>
        <div style={{ width: 52, height: 5, background: accent, borderRadius: 3, marginBottom: 28 }} />
        <div style={{ color: "#fff", fontSize: hl, fontWeight: 900, lineHeight: 1.0, letterSpacing: -2, textAlign: "center", display: "flex" }}>
          {headline.slice(0, 45)}
        </div>
        {body ? (
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: bl, marginTop: 20, lineHeight: 1.45, textAlign: "center", display: "flex", maxWidth: "78%" }}>
            {body.slice(0, 100)}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 36, background: accent, color: "#0b0b12", fontSize: cl, fontWeight: 700, padding: isLink ? "16px 44px" : "20px 56px", borderRadius: 999 }}>
          {cta}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build the artwork React element + its dimensions for a given size key. */
export function creativeArtwork(
  opts: CreativeArtworkOptions,
  sizeKey = "portrait",
): { element: React.ReactElement; width: number; height: number } {
  const { w, h } = CREATIVE_SIZES[sizeKey] ?? CREATIVE_SIZES.portrait;
  const brand = opts.brand ?? {};
  const primary = brand.primaryColor || "#6d28d9";
  const accent = brand.accentColor || "#f59e0b";

  const placedImages = (Array.isArray(opts.placedImages) ? opts.placedImages : [])
    .map((img) => ({ ...img, url: ogSafeImage(img.url) }))
    .filter((img): img is PlacedImage => !!img.url);

  const props: TP = {
    w,
    h,
    primary,
    accent,
    headline: opts.headline || opts.concept || "Your headline here",
    body: opts.primaryText || "",
    cta: opts.callToAction || "Learn more",
    bgImage: ogSafeImage(opts.bgImageUrl),
    logoUrl: ogSafeImage(brand.logoUrl),
    placedImages,
  };

  // Story is too tall for side-by-side split; fold to vertical split inside splitTemplate.
  const tpl = opts.template ?? "overlay";

  const element =
    tpl === "split" ? splitTemplate(props) :
    tpl === "bold" ? boldTemplate(props) :
    overlayTemplate(props);

  return { element, width: w, height: h };
}

/** Render the designed artwork to PNG bytes (for uploading to an ad platform). */
export async function renderCreativeImageBytes(
  opts: CreativeArtworkOptions,
  sizeKey = "square",
): Promise<Uint8Array> {
  const { element, width, height } = creativeArtwork(opts, sizeKey);
  const res = new ImageResponse(element, { width, height });
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
