import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionLoading } from "@/components/section-loading";
import { requireRole } from "@/lib/auth/require-role";

import { SuperadminHeader } from "./superadmin-header";

export const metadata: Metadata = { title: "Superadministrador" };

const SECTIONS = [
  {
    href: "/superadmin/personal",
    title: "Personal",
    description: "Cuentas de administradores y choferes (RF-116 a RF-119)",
  },
  {
    href: "/superadmin/computadoras",
    title: "Computadoras",
    description: "Aprobar o revocar las computadoras de cada muelle (RF-120, RF-121)",
  },
  {
    href: "/superadmin/bitacora",
    title: "Bitácora",
    description: "Quién hizo cada cobro, recarga o cambio, con filtros (RF-122 a RF-124)",
  },
];

export default function SuperadminPage() {
  // Leer la sesión (cookie) es un dato de la petición: va dentro de Suspense.
  return (
    <Suspense fallback={<SectionLoading />}>
      <SuperadminHome />
    </Suspense>
  );
}

async function SuperadminHome() {
  const user = await requireRole("SUPERADMIN");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <SuperadminHeader userName={user.fullName} />
      <h1 className="font-heading text-brand text-3xl font-bold">Superadministrador</h1>

      <ul className="flex flex-col gap-3">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="border-brand/20 hover:border-brand flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-xs transition"
            >
              <span>
                <span className="font-heading text-brand block text-base font-bold">
                  {section.title}
                </span>
                <span className="text-ink-muted text-sm">{section.description}</span>
              </span>
              <span className="text-brand text-sm font-bold">Abrir →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
