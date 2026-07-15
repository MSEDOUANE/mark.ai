import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findRetouchTool } from "@/lib/creative/retouch-tools";

interface Body {
  toolId?: string;
  imageUrl?: string;
  /** Data-URL mask (white = area to act on) — required for eraser-style tools. */
  maskUrl?: string;
}

/**
 * Retouch: apply one photo tool (background removal, upscale, enhance,
 * restore, object removal, cleanup) to a single uploaded image. Returns the
 * edited image URL, or a structured error the client renders inline.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image editing is not configured (FAL_KEY missing)" },
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

  const tool = findRetouchTool(body.toolId ?? "");
  if (!tool) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  }

  const maskUrl = (body.maskUrl ?? "").trim() || undefined;
  if (tool.needsMask && !maskUrl) {
    return NextResponse.json(
      { error: "Brush over an area first — this tool needs a mask." },
      { status: 400 },
    );
  }

  try {
    const url = await tool.run({ imageUrl, maskUrl, apiKey });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : "Editing failed" },
      { status: 502 },
    );
  }
}
