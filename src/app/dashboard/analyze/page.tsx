import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "../coming-soon";

export default async function AnalyzePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <ComingSoon
      icon="📊"
      title="Analyze"
      blurb="Creative performance analysis, competitor research, website audits, and marketing analytics — in one place."
      bullets={[
        "Creative performance & ad insights from your live Meta campaigns",
        "Competitor analysis via the Meta Ad Library",
        "Website analysis — messaging, offers, and ad-angle extraction",
      ]}
    />
  );
}
