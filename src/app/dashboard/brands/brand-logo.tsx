"use client";

/**
 * Brand logo image with a graceful hide-on-broken fallback. Lives in its own
 * client component because the `onError` handler can't be passed from the
 * Server Component that renders the brand cards.
 */
export function BrandLogo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
