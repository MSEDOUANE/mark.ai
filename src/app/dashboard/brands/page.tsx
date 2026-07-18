import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { DeleteBrandButton } from "./delete-brand-button";
import { BrandLogo } from "./brand-logo";

export default async function BrandsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const brands = await db
    .select()
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.orgId, org.id))
    .orderBy(desc(schema.brandProfiles.createdAt));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Brand Profiles</h1>
            <p className="mt-1 text-sm text-app-text-muted">
              Save your brand identity once — reuse it across all creatives.
            </p>
          </div>
          <Link href="/dashboard/brands/new"
            className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
            + New brand
          </Link>
        </div>

        {brands.length === 0 ? (
          /* Empty state */
          <div className="mt-20 flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-app-surface-2/80">
              <svg className="h-9 w-9 text-app-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold">No brand profiles yet</h2>
            <p className="mt-2 max-w-sm text-sm text-app-text-subtle">
              Create a brand profile with your logo and colors. When generating
              creatives, pick a brand to auto-fill everything.
            </p>
            <Link href="/dashboard/brands/new"
              className="mt-6 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              Create your first brand →
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <BrandCard key={b.id} brand={b} />
            ))}

            {/* Add new card */}
            <Link href="/dashboard/brands/new"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-app-border-strong py-10 text-app-text-subtle transition-colors hover:border-zinc-500 hover:text-app-text">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-medium">Add brand</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function BrandCard({ brand }: {
  brand: {
    id: string; name: string; primaryColor: string | null;
    logoUrl: string | null; websiteUrl: string | null; tone: string | null;
    description: string | null;
  };
}) {
  const color = brand.primaryColor ?? "#7c3aed";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface transition-shadow hover:shadow-xl hover:shadow-black/40">
      {/* Color band + logo */}
      <div className="relative flex h-28 items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color}0a 100%)` }}>
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
        {brand.logoUrl ? (
          <BrandLogo src={brand.logoUrl} alt={brand.name} className="relative z-10 h-14 w-auto max-w-[160px] object-contain drop-shadow-lg" />
        ) : (
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black"
            style={{ backgroundColor: color, color: "#fff" }}>
            {brand.name[0].toUpperCase()}
          </div>
        )}

        {/* Color dot */}
        <div className="absolute right-3 top-3 h-5 w-5 rounded-full border-2 border-app-border shadow"
          style={{ backgroundColor: color }} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-app-text">{brand.name}</h3>
        {brand.tone ? (
          <p className="mt-0.5 text-xs text-app-text-subtle capitalize">{brand.tone}</p>
        ) : null}
        {brand.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-app-text-subtle">{brand.description}</p>
        ) : null}
        {brand.websiteUrl ? (
          <p className="mt-1.5 truncate text-[11px] text-app-text-subtle">{brand.websiteUrl}</p>
        ) : null}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-app-border pt-3">
          <Link href={`/dashboard/brands/${brand.id}/edit`}
            className="flex-1 rounded-lg border border-app-border-strong py-1.5 text-center text-xs font-medium text-app-text transition-colors hover:border-zinc-500 hover:text-app-text">
            Edit
          </Link>
          <Link
            href={`/dashboard/creatives/new?brandId=${brand.id}`}
            className="flex-1 rounded-lg bg-amber-400/10 py-1.5 text-center text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/20">
            Use brand
          </Link>
          <DeleteBrandButton id={brand.id} name={brand.name} />
        </div>
      </div>
    </div>
  );
}
