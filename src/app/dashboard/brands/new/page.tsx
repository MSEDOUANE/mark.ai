import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandForm } from "../brand-form";

export default async function NewBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard/brands" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Brands
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Create brand profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Save your brand identity to reuse it across all creatives.
          </p>
        </div>
        <BrandForm error={error} />
      </div>
    </main>
  );
}
