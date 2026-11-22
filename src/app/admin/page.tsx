import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Administrador" };

export default async function AdminPage() {
  const user = await requireRole("ADMIN");
  return (
    <ModulePlaceholder
      userName={user.fullName}
      role="Administrador (taquilla)"
      modules={[
        { name: "Abordaje y taquilla", owner: "Cova", requirements: "RF-043 a RF-054" },
        {
          name: "Operación de muelles y salidas",
          owner: "Pamela",
          requirements: "RF-055 a RF-068",
        },
        { name: "Gestión de flota", owner: "Pamela", requirements: "RF-088 a RF-093" },
        { name: "Gestión de choferes", owner: "Pamela", requirements: "RF-094 a RF-096" },
        { name: "Tarifas y descuentos", owner: "Cova", requirements: "RF-097 a RF-101" },
        { name: "Horario de servicio y avisos", owner: "José", requirements: "RF-102 a RF-105" },
        { name: "Reportes", owner: "Pamela", requirements: "RF-110 a RF-115" },
      ]}
    />
  );
}
