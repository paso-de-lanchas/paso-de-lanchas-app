import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionLoading } from "@/components/section-loading";
import { ACCOUNT_STATUSES, STAFF_ROLES } from "@/domain/staff/staff-rules";
import { requireRole } from "@/lib/auth/require-role";
import { listStaff } from "@/lib/superadmin/staff";

import { ROLE_LABEL, STATUS_LABEL, STATUS_STYLE } from "../labels";
import { SuperadminHeader } from "../superadmin-header";

export const metadata: Metadata = { title: "Personal | Superadministrador" };

const selectClass = "border-line text-ink rounded-xl border bg-white px-3 py-2 text-sm";

/** Lista de administradores y choferes con filtros por rol y estado (RF-116 a RF-118). */
export default function StaffListPage({ searchParams }: PageProps<"/superadmin/personal">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <StaffList searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffList({
  searchParams,
}: Pick<PageProps<"/superadmin/personal">, "searchParams">) {
  const user = await requireRole("SUPERADMIN");
  const { filter, accounts } = await listStaff(await searchParams);
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <SuperadminHeader userName={user.fullName} back={{ href: "/superadmin", label: "Inicio" }} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-brand text-3xl font-bold">Personal ({accounts.length})</h1>
        <Link
          href="/superadmin/personal/nuevo"
          className="bg-brand rounded-xl px-4 py-2.5 text-sm font-bold text-white"
        >
          + Nueva cuenta
        </Link>
      </div>

      <form
        method="GET"
        className="border-line flex flex-wrap items-end gap-4 rounded-2xl border bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-role" className="text-ink-muted text-xs font-bold">
            Rol
          </label>
          <select
            id="filter-role"
            name="role"
            defaultValue={filter.role ?? ""}
            className={selectClass}
          >
            <option value="">Todos</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-status" className="text-ink-muted text-xs font-bold">
            Estado
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={filter.status ?? ""}
            className={selectClass}
          >
            <option value="">Todos</option>
            {ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-brand rounded-xl px-4 py-2 text-sm font-bold text-white"
        >
          Filtrar
        </button>
        {(filter.role || filter.status) && (
          <Link
            href="/superadmin/personal"
            className="text-brand-accent text-sm font-bold underline"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {accounts.length === 0 ? (
        <p className="border-line text-ink-muted rounded-2xl border bg-white p-8 text-center">
          No hay cuentas con esos filtros.
        </p>
      ) : (
        <div className="border-line overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted border-line border-b text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Muelle</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-3">
                    <p className="text-ink font-bold">{account.fullName}</p>
                    <p className="text-ink-muted text-xs">{account.email}</p>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABEL[account.role]}</td>
                  <td className="px-4 py-3">{account.dockName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[account.status]}`}
                      >
                        {STATUS_LABEL[account.status]}
                      </span>
                      {account.lockedUntil && account.lockedUntil > now && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900">
                          Bloqueo por intentos
                        </span>
                      )}
                      {account.mustChangePassword && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                          Contraseña temporal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/superadmin/personal/${account.id}`}
                      className="text-brand-accent font-bold underline"
                      aria-label={`Administrar a ${account.fullName}`}
                    >
                      Administrar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
