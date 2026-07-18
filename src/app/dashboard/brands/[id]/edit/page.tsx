import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { BrandForm } from "../../brand-form";

export default async function EditBrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  const { id } = await params;
  const { error } = await searchParams;

  const [brand] = await db
    .select()
    .from(schema.brandProfiles)
    .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, org.id)))
    .limit(1);

  if (!brand) notFound();

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard/brands" className="text-sm text-app-text-muted hover:text-app-text">
            ← Brands
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Edit brand — {brand.name}</h1>
        </div>
        <BrandForm brand={brand} error={error} />
      </div>
    </main>
  );
}
