import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { strategistModel } from "@/lib/ai/models";

const schema = z.object({
  brandName: z.string().describe("Brand or company name from the page"),
  description: z
    .string()
    .describe("Short description of what the business or product does — 1-2 sentences"),
  tone: z
    .string()
    .nullable()
    .describe(
      "Brand tone/personality in 1-3 words (e.g. premium, playful, minimal). null if unclear.",
    ),
  brandColor: z
    .string()
    .nullable()
    .describe(
      "Primary brand color as a hex code (#rrggbb). Prefer og:theme-color or prominent " +
        "CSS color. null if not identifiable.",
    ),
  logoUrl: z
    .string()
    .nullable()
    .describe(
      "Absolute URL to the brand logo. Look for og:image tagged as logo, " +
        "apple-touch-icon, or <link rel=icon>. null if not found.",
    ),
  photoUrl: z
    .string()
    .nullable()
    .describe(
      "Absolute URL to a hero or product image suitable as ad background. " +
        "Prefer og:image if it looks like a product photo. null if not found.",
    ),
});

function toAbsolute(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  let target: string;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    target = u.href;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarkAI-BrandImport/1.0)",
        Accept: "text/html,*/*",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Site returned ${res.status}` },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not reach site: ${msg.slice(0, 120)}` },
      { status: 502 },
    );
  }

  // Strip noise before sending to AI
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 10_000);

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema,
      system:
        "You are a brand analyst. Extract brand identity from the HTML of a website. " +
        "Always return absolute URLs for logoUrl and photoUrl. " +
        "For brandColor prefer a vivid, non-white hex (#rrggbb). " +
        "If a field cannot be determined with confidence, return null.",
      prompt: `Page URL: ${target}\n\nHTML:\n${clean}`,
    });

    return NextResponse.json({
      ...object,
      logoUrl: toAbsolute(object.logoUrl, target),
      photoUrl: toAbsolute(object.photoUrl, target),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message.slice(0, 200) : "AI extraction failed",
      },
      { status: 500 },
    );
  }
}
