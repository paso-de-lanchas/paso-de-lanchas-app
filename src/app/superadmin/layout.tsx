import { House, Laptop, ScrollText, ShieldCheck } from "lucide-react";

import type { NavItem } from "@/components/navigation/bottom-nav";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { Suspense } from "react";

const icon = "size-4";

const items: NavItem[] = [
  { href: "/superadmin", label: "Inicio", icon: <House className={icon} />, exact: true },
  { href: "/superadmin/personal", label: "Personal", icon: <ShieldCheck className={icon} /> },
  { href: "/superadmin/computadoras", label: "Computadoras", icon: <Laptop className={icon} /> },
  { href: "/superadmin/bitacora", label: "Bitácora", icon: <ScrollText className={icon} /> },
];

export default function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Suspense fallback={<aside className="md:w-64 md:shrink-0" />}>
        <SidebarNav title="Superadministración" items={items} />
        <div className="min-w-0 flex-1">{children}</div>
      </Suspense>
    </div>
  );
}
