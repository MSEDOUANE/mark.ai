import { redirect } from "next/navigation";

// The compose flow has been merged into /dashboard/creatives/new.
export default function ComposeRedirect() {
  redirect("/dashboard/creatives/new");
}
