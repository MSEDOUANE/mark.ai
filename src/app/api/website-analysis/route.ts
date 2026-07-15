import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { strategistModel } from "@/lib/ai/models";

/**
 * Website Analysis — a fuller audit than /api/brand-import (which only pulls
 * brand-kit fields for autofill). Same fetch+strip skeleton, richer schema:
 * messaging, offers, and ad-angle extraction for the Analyze section.
 */
const schema = z.object({
  brandName: z.string(),
  valueProposition: z.string().describe("The core promise/value prop in one sentence"),
  targetAudience: z.string().describe("Who this site is clearly speaking to"),
  toneOfVoice: z.string().describe("1-3 words describing the writing style"),
  keyMessages: z.array(z.string()).min(2).max(5).describe("The main claims/messages repeated across the page"),
  currentOffers: z.array(z.string()).max(4).describe("Any promotions, discounts, or offers found. Empty array if none."),
  strengths: z.array(z.string()).min(2).max(4).describe("What the site does well from a conversion standpoint"),
  weaknesses: z.array(z.string()).min(1).max(4).describe("Missed opportunities — weak CTAs, unclear offer, no urgency, etc."),
  suggestedAdAngles: z.array(z.string()).min(3).max(6).describe("Ad angles/hooks this business should run based on what's actually on the site"),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        "User-Agent": "Mozilla/5.0 (compatible; MarkAI-WebsiteAnalysis/1.0)",
        Accept: "text/html,*/*",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Site returned ${res.status}` }, { status: 502 });
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not reach site: ${msg.slice(0, 120)}` }, { status: 502 });
  }

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
        "You are a conversion-rate-optimization and messaging analyst reviewing a website for " +
        "ad-campaign readiness. Be concrete and specific to what's actually on the page — never " +
        "generic advice. Ground suggested ad angles in real messages/offers found on the site.",
      prompt: `Page URL: ${target}\n\nHTML:\n${clean}`,
    });

    return NextResponse.json({ ...object, url: target });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 200) : "Analysis failed" },
      { status: 500 },
    );
  }
}
