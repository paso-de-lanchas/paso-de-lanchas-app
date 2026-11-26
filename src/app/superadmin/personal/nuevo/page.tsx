import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionLoading } from "@/components/section-loading";
import { requireRole } from "@/lib/auth/require-role";
import { listDocks } from "@/lib/superadmin/staff";

import { SuperadminHeader } from "../../superadmin-header";
import { NewStaffForm } from "./new-staff-form";

export const metadata: Metadata = { title: "Nueva cuenta del personal | Superadministrador" };

/** Alta de administrador o chofer (RF-116, RF-117). */
export default function NewStaffPage() {
  return (
    <Suspense fallback={<SectionLoading />}>
      <NewStaff />
    </Suspense>
  );
}

async function NewStaff() {
  const user = await requireRole("SUPERADMIN");
  const docks = await listDocks();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <SuperadminHeader
        userName={user.fullName}
        back={{ href: "/superadmin/personal", label: "Personal" }}
      />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-brand text-3xl font-bold">Nueva cuenta</h1>
        <p className="text-ink-muted">
          Se crea activa y con una contraseña temporal que deberá cambiar al entrar.
        </p>
      </div>
      <NewStaffForm docks={docks} />
    </main>
  );
}
