import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { ProductForm } from "../product-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error } = await searchParams;

  const brands = await db
    .select({ id: schema.brandProfiles.id, name: schema.brandProfiles.name })
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.orgId, org.id))
    .orderBy(desc(schema.brandProfiles.createdAt));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard/products" className="text-sm text-app-text-muted hover:text-app-text">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Add product</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Save it once — reuse across creatives, campaigns, videos, and landing pages.
          </p>
        </div>
        <ProductForm brands={brands} error={error} />
      </div>
    </main>
  );
}
