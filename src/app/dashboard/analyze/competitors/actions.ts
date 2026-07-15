"use server";

import { and, eq } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { strategistModel } from "@/lib/ai/models";
import { searchAdLibrary, type CompetitorAd } from "@/lib/ads/ad-library";
import { decryptSecret } from "@/lib/crypto";

/* ── Live Meta Ad Library search ──────────────────────────────────────── */

export type AdLibraryState =
  | { status: "idle" }
  | { status: "success"; ads: CompetitorAd[]; searchTerms: string }
  | { status: "error"; message: string };

export async function searchCompetitorAds(
  _prev: AdLibraryState,
  formData: FormData,
): Promise<AdLibraryState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const searchTerms = String(formData.get("searchTerms") ?? "").trim();
  const country = String(formData.get("country") ?? "FR").trim() || "FR";
  if (!searchTerms) return { status: "error", message: "Enter a competitor name to search." };

  const [account] = await db
    .select()
    .from(schema.adAccounts)
    .where(
      and(eq(schema.adAccounts.orgId, org.id), eq(schema.adAccounts.platform, "meta")),
    )
    .limit(1);

  if (!account?.encryptedToken) {
    return {
      status: "error",
      message: "Connect a Meta ad account in Settings to search live competitor ads.",
    };
  }

  try {
    const ads = await searchAdLibrary(
      { searchTerms, countries: [country], limit: 15 },
      decryptSecret(account.encryptedToken),
    );
    return { status: "success", ads, searchTerms };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Ad Library search failed",
    };
  }
}

/* ── AI competitor report ─────────────────────────────────────────────── */

const competitorSchema = z.object({
  name: z.string(),
  positioning: z.string().describe("How they position themselves / their main angle"),
  strengths: z.string(),
  gaps: z.string().describe("Weaknesses or gaps this product can exploit"),
  estimatedAdAngles: z.array(z.string()).min(2).max(4).describe("Likely ad hooks/angles they run, based on their positioning"),
});

const competitorReportSchema = z.object({
  competitors: z.array(competitorSchema).min(2).max(5),
  differentiationOpportunity: z.string().describe("The clearest way this product can stand out from the field above"),
  recommendedAngles: z.array(z.string()).min(2).max(4).describe("Ad angles this product should run that competitors are NOT using"),
});

export type CompetitorReport = z.infer<typeof competitorReportSchema>;

export type CompetitorReportState =
  | { status: "idle" }
  | { status: "success"; result: CompetitorReport; productName: string }
  | { status: "error"; message: string };

export async function generateCompetitorReport(
  _prev: CompetitorReportState,
  formData: FormData,
): Promise<CompetitorReportState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureProfile(user);

  function field(key: string) {
    const v = String(formData.get(key) ?? "").trim();
    return v || null;
  }

  const productName = field("productName");
  if (!productName) return { status: "error", message: "Product / brand name is required." };

  const prompt = [
    `Product / brand: ${productName}`,
    field("description") && `Description: ${field("description")}`,
    field("competitors") && `Known or suspected competitors: ${field("competitors")}`,
    field("market") && `Market / geography: ${field("market")}`,
    `\nIdentify 2-5 realistic competitors for this product (use the named ones if given, plus ` +
      `category peers you can reasonably infer). For each, estimate their positioning, strengths, ` +
      `gaps, and likely ad angles. Then recommend angles for THIS product that stand out from all of them.`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: strategistModel,
      schema: competitorReportSchema,
      system:
        "You are a competitive-intelligence analyst for performance marketing. Your competitor " +
        "profiles are informed estimates, not scraped data — be realistic and specific, not generic. " +
        "Every gap and recommended angle must be genuinely actionable.",
      prompt,
    });
    return { status: "success", result: object, productName };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message.slice(0, 200) : "Generation failed",
    };
  }
}
