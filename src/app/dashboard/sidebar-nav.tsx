"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/assistant", label: "Assistant ✦" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/campaigns/new", label: "New brief" },
  { href: "/dashboard/generate", label: "Generate" },
  { href: "/dashboard/creatives", label: "Creatives" },
  { href: "/dashboard/pages", label: "Pages" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 px-2 py-3">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "block rounded-lg border border-amber-300/25 bg-amber-950/25 px-3 py-2 text-sm font-medium text-zinc-50"
                : "block rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-300 hover:border-white/10 hover:bg-zinc-900 hover:text-zinc-50"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
