"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/assistant", label: "Assistant ✦" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/campaigns/new", label: "New brief", nested: true },
  { href: "/dashboard/generate", label: "Generate" },
  { href: "/dashboard/creatives", label: "Creatives" },
  { href: "/dashboard/pages", label: "Pages" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/settings", label: "Settings" },
];

function isCurrent(pathname: string, href: string) {
  return pathname === href;
}

function isSectionActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-1 px-2 py-3">
      {navItems.map((item) => {
        const current = isCurrent(pathname, item.href);
        const sectionActive = isSectionActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            onClick={onNavigate}
            className={
              current
                ? `block rounded-lg border border-amber-300/25 bg-amber-950/25 px-3 py-2 text-sm font-medium text-zinc-50 ${item.nested ? "ml-3" : ""}`
                : sectionActive
                  ? `block rounded-lg border border-transparent bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-100 ${item.nested ? "ml-3" : ""}`
                  : `block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-300 hover:border-white/10 hover:bg-zinc-900 hover:text-zinc-50 ${item.nested ? "ml-3" : ""}`
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-base font-semibold text-zinc-50">
          MarkAI
        </Link>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-200 hover:bg-zinc-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isOpen ? (
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 top-[57px] z-50 flex">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsOpen(false)}
            className="flex-1 bg-black/60"
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="flex h-full w-72 flex-col border-l border-white/10 bg-zinc-950 shadow-2xl shadow-black/50"
          >
            <SidebarNav onNavigate={() => setIsOpen(false)} />
            <p className="border-t border-white/10 px-4 py-3 text-xs text-zinc-400">
              AI recommendations stay gated by approval.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
