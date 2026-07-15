import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMG2IMG_MODEL, COMPOSE_MODEL, BG_REMOVE_MODEL } from "@/lib/creative/image-models/registry";

type Mode = "variation" | "background" | "edit";

interface Body {
  mode?: Mode;
  imageUrl?: string;
  /** Background mode: describes the new scene. Edit mode: the edit instruction. */
  prompt?: string;
}

/**
 * Image Studio — three lightweight single-image tools sharing the existing
 * IMG2IMG/COMPOSE/BG_REMOVE models:
 *  - variation: IMG2IMG_MODEL reinterprets the image as a fresh variant.
 *  - background: strip the background, then COMPOSE a new scene around it.
 *  - edit: COMPOSE_MODEL applies a free-text instruction to the image.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is not configured (FAL_KEY missing)" },
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

  const prompt = (body.prompt ?? "").trim();

  try {
    let url: string;
    switch (body.mode) {
      case "variation":
        url = await IMG2IMG_MODEL({ imageUrl, apiKey });
        break;

      case "background": {
        if (!prompt) return NextResponse.json({ error: "Describe the new background" }, { status: 400 });
        const cutout = await BG_REMOVE_MODEL({ imageUrl, apiKey });
        url = await COMPOSE_MODEL({
          prompt: `Place this exact subject into a new scene: ${prompt}. Preserve the subject's exact appearance — do not alter the subject itself, only the background.`,
          imageUrls: [cutout],
          apiKey,
        });
        break;
      }

      case "edit":
        if (!prompt) return NextResponse.json({ error: "Describe the edit you want" }, { status: 400 });
        url = await COMPOSE_MODEL({ prompt, imageUrls: [imageUrl], apiKey });
        break;

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : "Generation failed" },
      { status: 502 },
    );
  }
}
