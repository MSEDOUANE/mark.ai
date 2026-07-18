import { and, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { MobileNav, SidebarNav } from "./sidebar-nav";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

// Anti-FOUC: applies a saved "light" preference to <html> before first
// paint (a blocking inline script, not a React effect — the server can't
// know localStorage, and waiting for hydration would flash dark-then-light
// for returning light-mode users). Fixed literal string, no interpolation.
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('markai-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

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
    <div className="min-h-screen bg-app-bg text-app-text">
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <CommandPalette />
      <MobileNav approvalsCount={approvalsCount} />
      <aside className="fixed inset-y-0 left-0 hidden w-56 overflow-y-auto border-r border-white/10 bg-app-bg/90 backdrop-blur-xl md:flex md:flex-col lg:w-64">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-app-text-muted">Workspace</p>
          <h1 className="mt-1 text-lg font-semibold">MarkAI</h1>
        </div>
        <SidebarNav approvalsCount={approvalsCount} />
        <div className="border-t border-white/10 px-4 py-3 text-xs text-app-text-muted">
          <p>AI recommendations stay gated by approval.</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-app-text-subtle">
            Press <kbd className="rounded border border-white/10 bg-app-surface px-1.5 py-0.5 text-[10px]">⌘K</kbd> to search anything
          </p>
          <div className="mt-2.5">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="md:pl-56 lg:pl-64">{children}</div>
    </div>
  );
}
