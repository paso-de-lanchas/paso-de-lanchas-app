import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Pasajero" };

export default async function PassengerPage() {
  const user = await requireRole("PASSENGER");
  return (
    <ModulePlaceholder
      userName={user.fullName}
      role="Pasajero"
      modules={[
        { name: "Cuenta y perfil", owner: "José", requirements: "RF-014 a RF-020" },
        { name: "Saldo y recargas", owner: "Cova", requirements: "RF-021 a RF-031" },
        { name: "Código QR de abordaje", owner: "Diego", requirements: "RF-032 a RF-038" },
        { name: "Galería de vehículos", owner: "José", requirements: "RF-039 a RF-042" },
        { name: "Mapa y rastreo en vivo", owner: "Diego", requirements: "RF-077 a RF-081" },
        { name: "Información al pasajero", owner: "José", requirements: "RF-082 a RF-087" },
        { name: "Notificaciones", owner: "José", requirements: "RF-106 a RF-109" },
      ]}
    />
  );
}
