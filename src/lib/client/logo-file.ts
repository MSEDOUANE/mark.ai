"use client";

/**
 * Read a logo file as a data URL the creative renderer can draw. Satori (the
 * next/og engine that composites ad creatives) only supports PNG / JPEG / GIF /
 * SVG data URIs — anything else (WEBP, AVIF, …) is dropped from renders. So
 * satori-safe types pass through untouched, and every other browser-decodable
 * image is rasterized to PNG on a canvas.
 */
const SATORI_SAFE = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
]);

export async function logoFileToDataUrl(file: File): Promise<string> {
  if (SATORI_SAFE.has(file.type)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
