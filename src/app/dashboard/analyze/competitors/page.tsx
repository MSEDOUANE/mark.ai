import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompetitorAnalysisClient } from "./competitor-analysis-client";

export default async function CompetitorAnalysisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link href="/dashboard/analyze" className="text-sm text-app-text-muted hover:text-app-text">
            ← Analyze
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">🔬</span>
            <div>
              <h1 className="text-2xl font-bold">Competitor Analysis</h1>
              <p className="mt-0.5 text-sm text-app-text-muted">
                See what competitors are actually running, and where you can win.
              </p>
            </div>
          </div>
        </div>

        <CompetitorAnalysisClient />
      </div>
    </main>
  );
}
