import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionLoading } from "@/components/section-loading";
import { hasLoginLockout } from "@/domain/staff/staff-rules";
import { DomainError } from "@/domain/shared/domain-error";
import { requireRole } from "@/lib/auth/require-role";
import { getStaffAccount } from "@/lib/superadmin/staff";

import { formatDateTime, ROLE_LABEL, STATUS_LABEL, STATUS_STYLE } from "../../labels";
import { SuperadminHeader } from "../../superadmin-header";
import { StaffActions } from "./staff-actions";

export const metadata: Metadata = { title: "Cuenta del personal | Superadministrador" };

/** Detalle de un administrador o chofer con sus acciones (RF-118, RF-119). */
export default function StaffDetailPage({ params }: PageProps<"/superadmin/personal/[id]">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <StaffDetail params={params} />
    </Suspense>
  );
}

async function StaffDetail({ params }: Pick<PageProps<"/superadmin/personal/[id]">, "params">) {
  const user = await requireRole("SUPERADMIN");
  const { id } = await params;
  const account = await getStaffAccount(id).catch((error: unknown) => {
    // Id inválido, de otro rol (superadmin, pasajero) o inexistente: no se revela cuál.
    if (error instanceof DomainError && error.code === "STAFF_NOT_FOUND") notFound();
    throw error;
  });
  const now = new Date();
  const locked = !!account.lockedUntil && account.lockedUntil > now;

  const rows: [string, string][] = [
    ["Correo", account.email],
    ["Celular", account.phone ?? "—"],
    ["Rol", ROLE_LABEL[account.role]],
    ["Muelle", account.dockName ?? "—"],
    ["Alta", formatDateTime(account.createdAt)],
    ["Intentos fallidos", String(account.failedLoginAttempts)],
  ];
  if (locked) rows.push(["Bloqueada hasta", formatDateTime(account.lockedUntil!)]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <SuperadminHeader
        userName={user.fullName}
        back={{ href: "/superadmin/personal", label: "Personal" }}
      />

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">{account.fullName}</h1>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[account.status]}`}
          >
            {STATUS_LABEL[account.status]}
          </span>
          {account.mustChangePassword && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
              Contraseña temporal sin cambiar
            </span>
          )}
        </div>
      </div>

      <dl className="border-line grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border bg-white p-5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted font-bold">{label}</dt>
            <dd className="text-ink break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <StaffActions
        staffId={account.id}
        email={account.email}
        status={account.status}
        canUnlock={hasLoginLockout(account, now)}
      />
    </main>
  );
}
