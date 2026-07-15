import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ttsGenerate, musicGenerate, sfxGenerate } from "@/lib/creative/image-models/fal-audio-video";

type Mode = "voice" | "music" | "sfx";

interface Body {
  mode?: Mode;
  text?: string;
  language?: string;
  voice?: string;
  durationSeconds?: number;
}

/**
 * Audio Studio — standalone Voice / Music / SFX generation, stateless like
 * Retouch and Image Studio (no creative-library round trip).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Audio generation is not configured (FAL_KEY missing)" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Enter some text or a description" }, { status: 400 });
  }

  try {
    let url: string;
    switch (body.mode) {
      case "voice":
        url = await ttsGenerate({
          text,
          language: body.language ?? "en",
          voice: body.voice ?? "female",
          apiKey,
        });
        break;

      case "music":
        url = await musicGenerate({ prompt: text, durationSeconds: body.durationSeconds, apiKey });
        break;

      case "sfx":
        url = await sfxGenerate({ prompt: text, durationSeconds: body.durationSeconds, apiKey });
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
