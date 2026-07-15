import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "../coming-soon";

export default async function PredictPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <ComingSoon
      icon="🔮"
      title="Predict"
      blurb="AI scoring and forecasts for your creatives — calibrated against your own campaign performance, clearly labeled as estimates."
      bullets={[
        "Creative scoring & ranking (already live inside the creatives library)",
        "CTR and conversion-potential estimates",
        "Ad fatigue detection and predicted-winner badges",
      ]}
    />
  );
}
