import { and, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { MobileNav, SidebarNav } from "./sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pending-approval count for the sidebar badge — cheap, and the layout
  // already gates auth for every dashboard page.
  let approvalsCount = 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { org } = await ensureProfile(user);
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.approvals)
      .where(
        and(
          eq(schema.approvals.orgId, org.id),
          eq(schema.approvals.status, "pending"),
        ),
      );
    approvalsCount = n;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <MobileNav approvalsCount={approvalsCount} />
      <aside className="fixed inset-y-0 left-0 hidden w-56 overflow-y-auto border-r border-white/10 bg-zinc-950/90 backdrop-blur-xl md:flex md:flex-col lg:w-64">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Workspace</p>
          <h1 className="mt-1 text-lg font-semibold">MarkAI</h1>
        </div>
        <SidebarNav approvalsCount={approvalsCount} />
        <div className="border-t border-white/10 px-4 py-3 text-xs text-zinc-400">
          AI recommendations stay gated by approval.
        </div>
      </aside>

      <div className="md:pl-56 lg:pl-64">{children}</div>
    </div>
  );
}
