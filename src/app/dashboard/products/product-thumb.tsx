"use client";

/**
 * Product photo with a graceful hide-on-broken fallback. Client component
 * because `onError` can't be passed from the Server Component that renders
 * the product cards (same pattern as brands/brand-logo.tsx).
 */
export function ProductThumb({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
