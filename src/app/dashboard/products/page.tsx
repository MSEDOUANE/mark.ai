import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { DeleteProductButton } from "./delete-product-button";
import { ProductThumb } from "./product-thumb";
import { restoreProduct } from "./actions";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ undoId?: string; undoName?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { undoId, undoName } = await searchParams;

  const productRows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      description: schema.products.description,
      targetAudience: schema.products.targetAudience,
      brandProfileId: schema.products.brandProfileId,
      brand: schema.products.brand,
      createdAt: schema.products.createdAt,
      brandName: schema.brandProfiles.name,
    })
    .from(schema.products)
    .leftJoin(schema.brandProfiles, eq(schema.products.brandProfileId, schema.brandProfiles.id))
    .where(and(eq(schema.products.orgId, org.id), isNull(schema.products.deletedAt)))
    .orderBy(desc(schema.products.createdAt));

  const products = productRows.map((p) => ({
    ...p,
    photoUrl: ((p.brand ?? {}) as { photoUrl?: string | null }).photoUrl ?? null,
  }));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="mt-1 text-sm text-app-text-muted">
              Your reusable product catalog — pick from these when generating
              creatives, campaigns, videos, and landing pages.
            </p>
          </div>
          <Link href="/dashboard/products/new"
            className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
            + New product
          </Link>
        </div>

        {undoId && undoName ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-app-border-strong bg-app-surface-2 px-4 py-3 text-sm">
            <span className="text-app-text">
              Deleted <span className="font-semibold">&ldquo;{undoName}&rdquo;</span>.
            </span>
            <form action={restoreProduct}>
              <input type="hidden" name="id" value={undoId} />
              <button type="submit" className="font-semibold text-amber-400 hover:text-amber-300">
                Undo
              </button>
            </form>
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-app-surface-2/80">
              <svg className="h-9 w-9 text-app-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold">No products yet</h2>
            <p className="mt-2 max-w-sm text-sm text-app-text-subtle">
              Add a product once — name, description, audience, photo — and
              reuse it every time you generate a creative, campaign, video, or
              landing page.
            </p>
            <Link href="/dashboard/products/new"
              className="mt-6 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              Add your first product →
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}

            <Link href="/dashboard/products/new"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-app-border-strong py-10 text-app-text-subtle transition-colors hover:border-zinc-500 hover:text-app-text">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm font-medium">Add product</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({ product: p }: {
  product: {
    id: string; name: string; description: string | null;
    targetAudience: string | null; brandName: string | null; photoUrl: string | null;
  };
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface transition-shadow hover:shadow-xl hover:shadow-black/40">
      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-app-bg">
        {p.photoUrl ? (
          <ProductThumb src={p.photoUrl} alt={p.name} />
        ) : (
          <span className="text-3xl">📦</span>
        )}
        {p.brandName ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
            {p.brandName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-app-text">{p.name}</h3>
        {p.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-app-text-subtle">{p.description}</p>
        ) : null}
        {p.targetAudience ? (
          <p className="mt-1.5 line-clamp-1 text-[11px] text-app-text-subtle">🎯 {p.targetAudience}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-2 border-t border-app-border pt-3">
          <Link href={`/dashboard/products/${p.id}/edit`}
            className="flex-1 rounded-lg border border-app-border-strong py-1.5 text-center text-xs font-medium text-app-text transition-colors hover:border-zinc-500 hover:text-app-text">
            Edit
          </Link>
          <Link href={`/dashboard/creatives/new`}
            className="flex-1 rounded-lg bg-amber-400/10 py-1.5 text-center text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/20">
            Use product
          </Link>
          <DeleteProductButton id={p.id} name={p.name} />
        </div>
      </div>
    </div>
  );
}
