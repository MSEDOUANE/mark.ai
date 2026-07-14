import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoshootClient } from "./photoshoot-client";

export default async function ProductPhotosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Generate
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">📸</span>
            <div>
              <h1 className="text-2xl font-bold">Product Photo Ads</h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                Upload one product photo — get back professional studio shots
                in multiple styles. No studio, no photographer.
              </p>
            </div>
          </div>
        </div>

        <PhotoshootClient />
      </div>
    </main>
  );
}
