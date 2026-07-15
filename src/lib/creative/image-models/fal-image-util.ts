/**
 * Shared helpers for fal.ai image models.
 *
 * fal.ai cannot download external URLs that sit behind bot-protection, so any
 * URL that isn't already on fal's own CDN (or a data: URL) is fetched
 * server-side and re-sent as a base64 data URL.
 */

export async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Returns a URL fal.ai can read: passes through data:/fal URLs, base64-encodes the rest. */
export async function ensureFalReadable(imageUrl: string): Promise<string> {
  const readable =
    imageUrl.startsWith("data:") ||
    imageUrl.includes("fal.media") ||
    imageUrl.includes("fal.ai");
  if (readable) return imageUrl;

  const encoded = await toDataUrl(imageUrl);
  if (!encoded) throw new Error("could not fetch source image");
  return encoded;
}
