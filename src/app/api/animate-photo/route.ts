import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_MODEL } from "@/lib/creative/image-models/registry";

interface Body {
  imageUrl?: string;
}

/**
 * Turns a single still image into a short video clip (Product Videos / Motion
 * Effects). Stateless — no creative row is created, mirroring the Retouch and
 * Product Photoshoot tools.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Video generation is not configured (FAL_KEY missing)" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = (body.imageUrl ?? "").trim();
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  try {
    const url = await VIDEO_MODEL({
      imageUrl,
      apiKey,
      prompt:
        "Bring this scene to life with subtle cinematic motion — gentle camera push-in, " +
        "natural ambient movement, the subject stays sharp and true to the source image.",
    });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : "Animation failed" },
      { status: 502 },
    );
  }
}
