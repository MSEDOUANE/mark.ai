import { NextRequest, NextResponse } from "next/server";

export interface StockPhoto {
  id: string;
  thumb: string;
  full: string;
  photographer: string;
  source: "pexels" | "unsplash";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const perPage = 20;

  if (!q) return NextResponse.json({ photos: [], total: 0 });

  if (process.env.PEXELS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`,
        { headers: { Authorization: process.env.PEXELS_API_KEY } },
      );
      if (!res.ok) throw new Error(`Pexels ${res.status}`);
      const data = (await res.json()) as {
        photos: Array<{ id: number; src: { medium: string; large2x: string }; photographer: string }>;
        total_results: number;
      };
      const photos: StockPhoto[] = data.photos.map((p) => ({
        id: String(p.id),
        thumb: p.src.medium,
        full: p.src.large2x,
        photographer: p.photographer,
        source: "pexels",
      }));
      return NextResponse.json({ photos, total: data.total_results });
    } catch {
      // fall through to Unsplash
    }
  }

  if (process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`,
        { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } },
      );
      if (!res.ok) throw new Error(`Unsplash ${res.status}`);
      const data = (await res.json()) as {
        results: Array<{ id: string; urls: { small: string; regular: string }; user: { name: string } }>;
        total: number;
      };
      const photos: StockPhoto[] = data.results.map((p) => ({
        id: p.id,
        thumb: p.urls.small,
        full: p.urls.regular,
        photographer: p.user.name,
        source: "unsplash",
      }));
      return NextResponse.json({ photos, total: data.total });
    } catch {
      // fall through
    }
  }

  return NextResponse.json({
    photos: [],
    total: 0,
    error: "Add PEXELS_API_KEY or UNSPLASH_ACCESS_KEY to .env.local to enable stock photos",
  });
}
