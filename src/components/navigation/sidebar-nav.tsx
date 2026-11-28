"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { isActive, type NavItem } from "./bottom-nav";

export function SidebarNav({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-sidebar border-b md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <p className="font-heading text-brand px-4 pt-3 text-lg font-bold md:px-5 md:py-5">{title}</p>
      <nav
        aria-label="Navegación principal"
        className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3"
      >
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap",
                active ? "bg-brand text-white" : "text-ink hover:bg-surface",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
