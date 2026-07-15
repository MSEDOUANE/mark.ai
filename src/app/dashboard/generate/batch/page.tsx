import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { BatchGenerateClient } from "./batch-generate-client";

export default async function BatchGeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error } = await searchParams;

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      description: schema.products.description,
      brand: schema.products.brand,
    })
    .from(schema.products)
    .where(eq(schema.products.orgId, org.id))
    .orderBy(desc(schema.products.createdAt));

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Generate
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <div>
              <h1 className="text-2xl font-bold">Batch Generation</h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                One shared brief, applied across every product you pick — each gets its own AI-written, scored creative.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-5 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</p>
        )}

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <p className="text-3xl">📦</p>
            <p className="mt-3 text-sm text-zinc-500">Add products to your catalog first.</p>
            <Link href="/dashboard/products/new" className="mt-4 inline-block rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300">
              + New product
            </Link>
          </div>
        ) : (
          <BatchGenerateClient
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              photoUrl: ((p.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null,
            }))}
          />
        )}
      </div>
    </main>
  );
}
