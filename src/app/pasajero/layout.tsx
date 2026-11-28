import { House, QrCode, User, Wallet } from "lucide-react";

import { BottomNav, type NavItem } from "@/components/navigation/bottom-nav";
import { Suspense } from "react";

const items: NavItem[] = [
  { href: "/pasajero", label: "Inicio", icon: <House className="size-5" />, exact: true },
  { href: "/pasajero/qr", label: "QR", icon: <QrCode className="size-5" /> },
  { href: "/pasajero/saldo", label: "Saldo", icon: <Wallet className="size-5" /> },
  { href: "/pasajero/cuenta", label: "Cuenta", icon: <User className="size-5" /> },
];

export default function PassengerLayout({ children }: LayoutProps<"/pasajero">) {
  return (
    <>
      <div className="flex-1 pb-20">{children}</div>
      <Suspense fallback={null}>
        <BottomNav items={items} />
      </Suspense>
    </>
  );
}
