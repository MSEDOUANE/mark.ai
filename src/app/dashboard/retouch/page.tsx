import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "../coming-soon";

export default async function RetouchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <ComingSoon
      icon="🪄"
      title="Retouch"
      blurb="One-click photo cleanup — remove backgrounds, upscale, enhance, and erase objects from any image."
      bullets={[
        "Background removal & object erasing",
        "Image upscaling, enhancement, and restoration",
        "AI cleanup for polished product shots",
      ]}
    />
  );
}
