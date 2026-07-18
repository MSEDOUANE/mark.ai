import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RetouchClient } from "./retouch-client";

export default async function RetouchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard/generate" className="text-sm text-app-text-muted hover:text-app-text">
            ← Generate
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">🪄</span>
            <div>
              <h1 className="text-2xl font-bold">Retouch</h1>
              <p className="mt-0.5 text-sm text-app-text-muted">
                One-click photo cleanup — remove backgrounds, upscale, enhance, and erase objects.
              </p>
            </div>
          </div>
        </div>

        <RetouchClient />
      </div>
    </main>
  );
}
