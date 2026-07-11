import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";

const anthropic = createAnthropic({ baseURL: "https://api.anthropic.com/v1" });

interface ImageInput {
  url: string;
  label?: string;
}

interface GeneratePromptBody {
  images: ImageInput[];
  context?: string;
  /** "ai-compose" = full integrated shot; "background" (default) = scene behind overlays. */
  mode?: "ai-compose" | "background";
}

const BACKGROUND_SYSTEM_PROMPT =
  "You are an expert image-generation prompt writer for advertising creatives.\n\n" +
  "Given one or more product or brand images, write a concise STATIC BACKGROUND SCENE prompt " +
  "for a fast text-to-image diffusion model.\n\n" +
  "The prompt describes the BACKGROUND behind the ad copy — NOT the product itself " +
  "(which will be composited on top as a separate layer) and NOT any text or logos.\n\n" +
  "Rules:\n" +
  "- Describe a scene, mood, texture, or setting that fits the product category\n" +
  "- Include lighting style (soft diffused light, golden hour, studio, etc.)\n" +
  "- Include visual style (photorealistic, editorial, minimalist, lifestyle photography)\n" +
  "- Keep it concrete, 30–80 words\n" +
  "- No abstract concepts, no text/typography in the image\n" +
  "- Do NOT describe motion, video, or camera movements\n" +
  "- Do NOT describe the product or any logos\n\n" +
  "Respond with ONLY the prompt text — no explanation, no quotes, no labels.";

const COMPOSE_SYSTEM_PROMPT =
  "You are an expert prompt writer for a multi-image AI compositing model (Nano Banana).\n\n" +
  "You are given reference images — typically a PRODUCT photo and a MODEL/person photo. " +
  "Write ONE editing prompt that instructs the model to combine them into a single, " +
  "photorealistic advertising photograph where the model is naturally using, wearing, " +
  "or presenting the product in a fitting real-world scene.\n\n" +
  "Rules:\n" +
  "- Refer to the supplied images explicitly (e.g. 'the product in image 1', 'the person in image 2')\n" +
  "- Preserve the exact appearance of the product — same shape, color, label, and details\n" +
  "- Describe the pose/interaction (wearing, holding, using) so it looks natural\n" +
  "- Describe the setting, lighting, and photographic style (editorial, lifestyle, studio)\n" +
  "- Leave clear, uncluttered negative space for ad copy to be added later\n" +
  "- Keep it concrete, 40–90 words\n" +
  "- Do NOT add any text, captions, watermarks, or logos into the image\n\n" +
  "Respond with ONLY the prompt text — no explanation, no quotes, no labels.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as GeneratePromptBody;
  const { images, context, mode } = body;
  const isCompose = mode === "ai-compose";

  if (!images?.length) {
    return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
  }

  type ImagePart = { type: "image"; image: string | URL; mimeType?: string };
  type TextPart  = { type: "text";  text: string };

  const contentParts: Array<ImagePart | TextPart> = [];

  for (const img of images) {
    if (!img.url) continue;
    if (img.url.startsWith("data:")) {
      // Pass data URL directly — the SDK parses the media type automatically.
      contentParts.push({ type: "image", image: img.url });
    } else {
      try {
        contentParts.push({ type: "image", image: new URL(img.url) });
      } catch {
        // Skip malformed URLs silently.
      }
    }
  }

  if (!contentParts.length) {
    return NextResponse.json({ error: "No valid images provided" }, { status: 400 });
  }

  const userText = isCompose
    ? (context
        ? `These reference images are for: ${context}. Write the compositing prompt.`
        : "Write the compositing prompt for these reference images.")
    : (context
        ? `These images are for: ${context}. Generate a background scene prompt.`
        : "Generate a background scene prompt for these images.");
  contentParts.push({ type: "text", text: userText });

  try {
    const { text } = await generateText({
      model: anthropic("claude-opus-4-8"),
      system: isCompose ? COMPOSE_SYSTEM_PROMPT : BACKGROUND_SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentParts }],
    });

    return NextResponse.json({ prompt: text.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-prompt]", msg);
    return NextResponse.json({ error: "Generation failed", detail: msg }, { status: 500 });
  }
}
