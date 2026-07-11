"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import {
  buildCampaignSpec,
  launchRequiresApproval,
  type Autonomy,
} from "@/lib/manager/policy";
import { executeLaunch } from "@/lib/manager/execute";

function clean(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * Publish a standalone creative as a real (paused) Meta ad: wraps it in a
 * campaign, then routes through the SAME approval-gated launch path as
 * agent-planned campaigns — executeLaunch ships the full tree (campaign →
 * ad set → uploaded designed image → ad), all paused until enabled on Meta.
 */
export async function publishCreativeAsAd(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const creativeId = clean(formData, "creativeId");
  const adAccountId = clean(formData, "adAccountId");
  const websiteUrl = clean(formData, "websiteUrl");
  const dailyBudget = clean(formData, "dailyBudget");
  const geoCountries = clean(formData, "geoCountries") ?? "US";
  const objective = clean(formData, "objective") ?? "traffic";

  const fail = (msg: string) =>
    redirect(
      `/dashboard/creatives/${creativeId}/publish?error=` + encodeURIComponent(msg),
    );

  if (!creativeId) redirect("/dashboard/creatives");
  if (!websiteUrl) fail("Destination URL is required — the ad needs a landing page.");
  if (!adAccountId) fail("Pick an ad account to publish to.");

  const [creative] = await db
    .select()
    .from(schema.creatives)
    .where(and(eq(schema.creatives.id, creativeId!), eq(schema.creatives.orgId, org.id)))
    .limit(1);
  if (!creative) redirect("/dashboard/creatives");

  const [adAccount] = await db
    .select()
    .from(schema.adAccounts)
    .where(and(eq(schema.adAccounts.id, adAccountId!), eq(schema.adAccounts.orgId, org.id)))
    .limit(1);
  if (!adAccount?.encryptedToken) fail("That ad account is not connected.");

  const meta = (creative.meta ?? {}) as Record<string, unknown>;
  const headline = (meta.headline as string | undefined) ?? "Ad creative";
  const currency =
    ((adAccount!.meta ?? {}) as { currency?: string }).currency ?? "USD";
  const budgetText = dailyBudget ? `${dailyBudget} ${currency} / day` : null;

  // Wrap the creative in a campaign so the existing launch machinery applies.
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      orgId: org.id,
      productId: creative.productId,
      adAccountId: adAccount!.id,
      platform: adAccount!.platform,
      name: `Ad: ${headline}`.slice(0, 120),
      objective,
      status: "draft",
      currency,
      brief: {
        productName: headline,
        goal: objective,
        budget: budgetText,
        websiteUrl,
        geoCountries,
      },
    })
    .returning();

  await db
    .update(schema.creatives)
    .set({ campaignId: campaign.id })
    .where(eq(schema.creatives.id, creative.id));

  const [orgRow] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, org.id))
    .limit(1);
  const autonomy = (orgRow?.autonomyLevel ?? "approve_spend") as Autonomy;

  const spec = buildCampaignSpec({
    name: campaign.name,
    objective,
    currency,
    budget: budgetText,
  });

  if (launchRequiresApproval(autonomy)) {
    await db.insert(schema.approvals).values({
      orgId: org.id,
      entityType: "campaign_launch",
      entityId: campaign.id,
      status: "pending",
      requestedBy: user.id,
      payload: { spec, adAccountId: adAccount!.id, source: "publish-creative" },
    });
    await db
      .update(schema.campaigns)
      .set({ status: "pending_approval" })
      .where(eq(schema.campaigns.id, campaign.id));
  } else {
    await executeLaunch(campaign, spec, adAccount!, "user");
  }

  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/creatives");
  redirect(`/dashboard/campaigns/${campaign.id}`);
}
