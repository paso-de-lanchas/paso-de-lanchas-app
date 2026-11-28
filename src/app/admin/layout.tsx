import {
  Anchor,
  BadgePercent,
  Bell,
  ChartColumn,
  DollarSign,
  Landmark,
  Ship,
  Ticket,
  Users,
  Wallet,
  House,
} from "lucide-react";

import { SidebarNav } from "@/components/navigation/sidebar-nav";
import type { NavItem } from "@/components/navigation/bottom-nav";
import { Suspense } from "react";

const icon = "size-4";

const items: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: <House className={icon} />, exact: true },
  { href: "/admin/operacion", label: "Operación", icon: <Anchor className={icon} /> },
  { href: "/admin/taquilla", label: "Taquilla", icon: <Ticket className={icon} /> },
  { href: "/admin/recargas", label: "Recargas", icon: <Wallet className={icon} /> },
  { href: "/admin/flota", label: "Flota", icon: <Ship className={icon} /> },
  { href: "/admin/tarifas", label: "Tarifas", icon: <DollarSign className={icon} /> },
  { href: "/admin/descuentos", label: "Descuentos", icon: <BadgePercent className={icon} /> },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<aside className="md:w-64 md:shrink-0" />}>
        <div className="flex flex-1 flex-col md:flex-row">
          <SidebarNav title="Administración" items={items} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </Suspense>
    </>
  );
}
