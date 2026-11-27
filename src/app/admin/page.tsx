import type { Metadata } from "next";
import Link from "next/link";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Administrador" };

export default async function AdminPage() {
  const user = await requireRole("ADMIN");
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="px-6 pt-6">
        <Link
          href="/admin/descuentos"
          className="border-brand/20 text-brand hover:border-brand flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-xs transition"
        >
          <div>
            <p className="font-heading text-brand text-base font-bold">Revisión de descuentos</p>
            <p className="text-ink-muted text-xs">
              Valida credenciales de Estudiante o INAPAM y asigna vigencia (RF-019 y RF-020)
            </p>
          </div>
          <span className="text-brand text-sm font-bold">Abrir →</span>
        </Link>
      </div>

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
          {
            name: "Tarifas y descuentos",
            owner: "Cova",
            requirements: "RF-097 a RF-101",
            href: "/admin/tarifas",
          },
          {
            name: "Horario de servicio y avisos",
            owner: "José",
            requirements: "RF-102 a RF-105",
          },
          { name: "Reportes", owner: "Pamela", requirements: "RF-110 a RF-115" },
        ]}
      />
    </div>
  );
}
