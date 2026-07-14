import { NextRequest, NextResponse } from "next/server";

export interface StockVideo {
  id: string;
  thumb: string;
  /** Playable video URL — a reasonably-sized mp4 (sd quality when available). */
  preview: string;
  /** Best-quality mp4 URL for download. */
  full: string;
  durationSeconds: number;
  photographer: string;
  source: "pexels";
}

/** Stock video search — Pexels only (Unsplash has no video API). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const perPage = 12;

  if (!q) return NextResponse.json({ videos: [], total: 0 });

  if (!process.env.PEXELS_API_KEY) {
    return NextResponse.json({
      videos: [],
      total: 0,
      error: "Add PEXELS_API_KEY to .env.local to enable stock videos",
    });
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } },
    );
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const data = (await res.json()) as {
      videos: Array<{
        id: number;
        image: string;
        duration: number;
        user: { name: string };
        video_files: Array<{
          link: string;
          quality: string; // "sd" | "hd" | "uhd"
          file_type: string;
          width: number | null;
        }>;
      }>;
      total_results: number;
    };

    const videos: StockVideo[] = data.videos
      .map((v) => {
        const mp4Files = v.video_files.filter((f) => f.file_type === "video/mp4");
        // Smallest reasonable file for grid preview (keeps bandwidth sane);
        // largest available for the actual download.
        const byWidth = [...mp4Files].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
        const preview = byWidth.find((f) => (f.width ?? 0) >= 480) ?? byWidth[0];
        const full = byWidth[byWidth.length - 1];
        if (!preview || !full) return null;
        return {
          id: String(v.id),
          thumb: v.image,
          preview: preview.link,
          full: full.link,
          durationSeconds: v.duration,
          photographer: v.user.name,
          source: "pexels" as const,
        };
      })
      .filter((v): v is StockVideo => v !== null);

    return NextResponse.json({ videos, total: data.total_results });
  } catch {
    return NextResponse.json({
      videos: [],
      total: 0,
      error: "Stock video search failed — try again shortly",
    });
  }
}
