import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";

export interface SearchResult {
  kind: "campaign" | "creative" | "brand" | "product" | "video" | "page";
  label: string;
  subtitle: string;
  href: string;
}

/**
 * Global search for the command palette (Ctrl/Cmd+K) — org-scoped, one
 * lightweight query per entity type, capped at 5 results each so the whole
 * response stays fast even with a broad "everything matching this word" scan.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { org } = await ensureProfile(user);

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const pattern = `%${q}%`;

  const [campaigns, creatives, brands, products, videos, pages] = await Promise.all([
    db
      .select({ id: schema.campaigns.id, name: schema.campaigns.name, objective: schema.campaigns.objective })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.orgId, org.id), ilike(schema.campaigns.name, pattern)))
      .orderBy(desc(schema.campaigns.createdAt))
      .limit(5),

    // meta::text (not meta->>'headline') — some existing creative rows have
    // a double-JSON-encoded meta column (a jsonb string containing escaped
    // JSON, not a jsonb object), which makes the ->> operator return null.
    // Casting the whole column to text and matching against that is immune
    // to either encoding, at the cost of also matching other meta fields
    // (acceptable — this is a "search everything about this creative" box).
    db
      .select({ id: schema.creatives.id, meta: schema.creatives.meta })
      .from(schema.creatives)
      .where(
        and(
          eq(schema.creatives.orgId, org.id),
          sql`${schema.creatives.meta}::text ILIKE ${pattern}`,
        ),
      )
      .orderBy(desc(schema.creatives.createdAt))
      .limit(5),

    db
      .select({ id: schema.brandProfiles.id, name: schema.brandProfiles.name })
      .from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.orgId, org.id), ilike(schema.brandProfiles.name, pattern)))
      .orderBy(desc(schema.brandProfiles.createdAt))
      .limit(5),

    db
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.orgId, org.id), ilike(schema.products.name, pattern)))
      .orderBy(desc(schema.products.createdAt))
      .limit(5),

    db
      .select({ id: schema.videoProjects.id, title: schema.videoProjects.title })
      .from(schema.videoProjects)
      .where(and(eq(schema.videoProjects.orgId, org.id), ilike(schema.videoProjects.title, pattern)))
      .orderBy(desc(schema.videoProjects.createdAt))
      .limit(5),

    db
      .select({ id: schema.landingPages.id, title: schema.landingPages.title, slug: schema.landingPages.slug })
      .from(schema.landingPages)
      .where(and(eq(schema.landingPages.orgId, org.id), or(ilike(schema.landingPages.title, pattern), ilike(schema.landingPages.slug, pattern))))
      .orderBy(desc(schema.landingPages.createdAt))
      .limit(5),
  ]);

  const results: SearchResult[] = [
    ...campaigns.map((c): SearchResult => ({
      kind: "campaign", label: c.name, subtitle: c.objective ?? "Campaign", href: `/dashboard/campaigns/${c.id}`,
    })),
    ...creatives.map((c): SearchResult => {
      const meta = (c.meta ?? {}) as Record<string, unknown>;
      return {
        kind: "creative",
        label: (meta.headline as string) || (meta.concept as string) || "Ad creative",
        subtitle: "Creative",
        href: "/dashboard/creatives",
      };
    }),
    ...brands.map((b): SearchResult => ({
      kind: "brand", label: b.name, subtitle: "Brand", href: `/dashboard/brands/${b.id}`,
    })),
    ...products.map((p): SearchResult => ({
      kind: "product", label: p.name, subtitle: "Product", href: `/dashboard/products/${p.id}`,
    })),
    ...videos.map((v): SearchResult => ({
      kind: "video", label: v.title, subtitle: "Video Studio", href: `/dashboard/videos/${v.id}`,
    })),
    ...pages.map((p): SearchResult => ({
      kind: "page", label: p.title, subtitle: `/p/${p.slug}`, href: `/p/${p.slug}`,
    })),
  ];

  return NextResponse.json({ results });
}
