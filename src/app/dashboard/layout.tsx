import { MobileNav, SidebarNav } from "./sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <MobileNav />
      <aside className="fixed inset-y-0 left-0 hidden w-56 overflow-y-auto border-r border-white/10 bg-zinc-950/90 backdrop-blur-xl md:flex md:flex-col lg:w-64">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Workspace</p>
          <h1 className="mt-1 text-lg font-semibold">MarkAI</h1>
        </div>
        <SidebarNav />
        <div className="border-t border-white/10 px-4 py-3 text-xs text-zinc-400">
          AI recommendations stay gated by approval.
        </div>
      </aside>

      <div className="md:pl-56 lg:pl-64">{children}</div>
    </div>
  );
}
