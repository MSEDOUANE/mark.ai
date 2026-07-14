import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { createLandingPage, deleteLandingPage } from "./actions";

const field =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);
  const { error, created } = await searchParams;

  const [pages, products] = await Promise.all([
    db
      .select()
      .from(schema.landingPages)
      .where(eq(schema.landingPages.orgId, org.id))
      .orderBy(desc(schema.landingPages.createdAt)),
    db
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.orgId, org.id),
          isNotNull(schema.products.brandProfileId),
        ),
      )
      .orderBy(desc(schema.products.createdAt)),
  ]);

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold">Landing Pages</h1>
        <p className="mt-1 text-sm text-zinc-400">
          AI-written, on-brand pages your ads click through to — hero, benefits,
          FAQ, and one clear CTA.
        </p>

        {created ? (
          <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            Page created —{" "}
            <a href={`/p/${created}`} target="_blank" className="underline">
              /p/{created}
            </a>{" "}
            — use this URL as your campaign&apos;s destination.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Generate form */}
          <form
            action={createLandingPage}
            className="h-fit space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <h2 className="text-lg font-semibold">New page</h2>

            {products.length > 0 ? (
              <label className="block text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Catalog product</span>
                  <Link href="/dashboard/products/new" className="text-xs text-amber-400 hover:underline">
                    + New product
                  </Link>
                </div>
                <select name="productId" className={`mt-1.5 ${field}`} defaultValue="">
                  <option value="">— pick a product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-sm">
              <span className="text-zinc-400">
                {products.length > 0 ? "…or a product name" : "Product name *"}
              </span>
              <input name="productName" placeholder="Reveria Signature Collection" className={`mt-1.5 ${field}`} />
            </label>

            <label className="block text-sm">
              <span className="text-zinc-400">Extra context (optional)</span>
              <textarea name="productDescription" rows={2} className={`mt-1.5 ${field}`}
                placeholder="Anything the page should emphasize" />
            </label>

            <div className="text-sm">
              <span className="text-zinc-400">Call to action</span>
              <div className="mt-1.5 space-y-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="ctaKind" value="whatsapp" defaultChecked />
                  <span>Order on WhatsApp</span>
                </label>
                <input name="whatsappNumber" placeholder="WhatsApp number, e.g. 2126XXXXXXXX" className={field} />
                <label className="flex items-center gap-2">
                  <input type="radio" name="ctaKind" value="link" />
                  <span>Follow a link</span>
                </label>
                <input name="ctaUrl" type="url" placeholder="https://yourstore.com/checkout" className={field} />
              </div>
            </div>

            <button className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300">
              Generate page
            </button>
            <p className="text-xs text-zinc-600">
              Written in the product&apos;s brand voice; takes ~15 seconds.
            </p>
          </form>

          {/* Existing pages */}
          <div className="space-y-3">
            {pages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
                No pages yet — generate one and use its URL as your ad&apos;s destination.
              </div>
            ) : (
              pages.map((p) => (
                <div key={p.id}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.title}</p>
                    <a href={`/p/${p.slug}`} target="_blank"
                      className="text-sm text-amber-400 hover:underline">
                      /p/{p.slug}
                    </a>
                  </div>
                  <Link href={`/dashboard/campaigns/new`}
                    className="shrink-0 rounded-lg bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/20">
                    Use in campaign
                  </Link>
                  <form action={deleteLandingPage}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300">
                      Delete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
