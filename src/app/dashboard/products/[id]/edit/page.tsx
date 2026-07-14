import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({
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

  const [productRow] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, id), eq(schema.products.orgId, org.id)))
    .limit(1);
  if (!productRow) notFound();

  const brands = await db
    .select({ id: schema.brandProfiles.id, name: schema.brandProfiles.name })
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.orgId, org.id))
    .orderBy(desc(schema.brandProfiles.createdAt));

  const product = {
    id: productRow.id,
    name: productRow.name,
    brandProfileId: productRow.brandProfileId,
    description: productRow.description,
    targetAudience: productRow.targetAudience,
    photoUrl: ((productRow.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null,
  };

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard/products" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Edit product — {product.name}</h1>
        </div>
        <ProductForm product={product} brands={brands} error={error} />
      </div>
    </main>
  );
}
