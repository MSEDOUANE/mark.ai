import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPOSE_MODEL } from "@/lib/creative/image-models/registry";
import { PHOTOSHOOT_STYLES } from "@/lib/ai/photoshoot-styles";

interface Body {
  photoUrl?: string;
  styleIds?: string[];
}

/**
 * Product Photo Ads: turn one uploaded product photo into professional
 * "shoot" variants. Each style renders independently (Promise.allSettled) so
 * one failure doesn't sink the whole batch — the client shows per-style
 * results as they resolve.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Image generation is not configured (FAL_KEY missing)" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const photoUrl = (body.photoUrl ?? "").trim();
  if (!photoUrl) {
    return NextResponse.json({ error: "photoUrl is required" }, { status: 400 });
  }

  const requestedIds = (body.styleIds ?? []).filter(Boolean);
  const styles = requestedIds.length
    ? PHOTOSHOOT_STYLES.filter((s) => requestedIds.includes(s.id))
    : PHOTOSHOOT_STYLES;
  if (styles.length === 0) {
    return NextResponse.json({ error: "No valid styles selected" }, { status: 400 });
  }
  // Cap to avoid an accidental huge fal.ai bill from one request.
  const capped = styles.slice(0, 6);

  const settled = await Promise.allSettled(
    capped.map((style) =>
      COMPOSE_MODEL({
        prompt: style.prompt,
        imageUrls: [photoUrl],
        apiKey,
        aspectRatio: "1:1",
      }),
    ),
  );

  const results = settled.map((r, i) => ({
    styleId: capped[i].id,
    label: capped[i].label,
    ...(r.status === "fulfilled"
      ? { url: r.value }
      : { error: r.reason instanceof Error ? r.reason.message.slice(0, 200) : "Generation failed" }),
  }));

  return NextResponse.json({ results });
}
