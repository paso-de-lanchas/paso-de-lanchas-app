import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { createListAuditLogs, type AuditLogFilters } from "@/application/audit/list-audit-logs";
import { SectionLoading } from "@/components/section-loading";
import { auditActionLabel } from "@/domain/audit/audit-log";
import { createPrismaAuditLogReader } from "@/infrastructure/audit/prisma-audit-log-reader";
import { requireRole } from "@/lib/auth/require-role";

import { formatDateTime } from "../labels";
import { SuperadminHeader } from "../superadmin-header";

export const metadata: Metadata = { title: "Bitácora | Superadministrador" };

const inputClass = "border-line text-ink rounded-xl border bg-white px-3 py-2 text-sm";
const FIELD_LABELS: Record<string, string> = {
  usuario: "usuario",
  accion: "acción",
  desde: "desde",
  hasta: "hasta",
  pagina: "página",
};

/** Bitácora de auditoría, solo lectura (RF-122 a RF-124). */
export default function AuditLogPage({ searchParams }: PageProps<"/superadmin/bitacora">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <AuditLogList searchParams={searchParams} />
    </Suspense>
  );
}

function pageHref(filters: AuditLogFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.usuario) params.set("usuario", filters.usuario);
  if (filters.accion) params.set("accion", filters.accion);
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  params.set("pagina", String(page));
  return `/superadmin/bitacora?${params.toString()}`;
}

async function AuditLogList({
  searchParams,
}: Pick<PageProps<"/superadmin/bitacora">, "searchParams">) {
  const user = await requireRole("SUPERADMIN");
  const result = await createListAuditLogs(createPrismaAuditLogReader())(await searchParams);
  const { filters } = result;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <SuperadminHeader userName={user.fullName} back={{ href: "/superadmin", label: "Inicio" }} />
      <div>
        <h1 className="font-heading text-brand text-3xl font-bold">Bitácora</h1>
        <p className="text-ink-muted text-sm">
          Registro de cada acción del sistema. Es de solo lectura: nadie puede modificarlo ni
          borrarlo.
        </p>
      </div>

      <form
        method="GET"
        className="border-line flex flex-wrap items-end gap-4 rounded-2xl border bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="usuario" className="text-ink-muted text-xs font-bold">
            Usuario (correo)
          </label>
          <input
            id="usuario"
            name="usuario"
            type="search"
            maxLength={120}
            defaultValue={filters.usuario ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="accion" className="text-ink-muted text-xs font-bold">
            Acción
          </label>
          <select
            id="accion"
            name="accion"
            defaultValue={filters.accion ?? ""}
            className={inputClass}
          >
            <option value="">Todas</option>
            {result.actions.map((action) => (
              <option key={action} value={action}>
                {auditActionLabel(action)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="desde" className="text-ink-muted text-xs font-bold">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={filters.desde ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hasta" className="text-ink-muted text-xs font-bold">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={filters.hasta ?? ""}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="bg-brand rounded-xl px-4 py-2 text-sm font-bold text-white"
        >
          Filtrar
        </button>
        <Link href="/superadmin/bitacora" className="text-brand text-sm font-bold underline">
          Quitar filtros
        </Link>
      </form>

      {result.invalid.length > 0 && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          Se ignoró un filtro no válido:{" "}
          {result.invalid.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.
        </p>
      )}

      <p className="text-ink-muted text-sm" aria-live="polite">
        {result.total} registro{result.total === 1 ? "" : "s"} · página {result.page} de{" "}
        {result.totalPages}
      </p>

      <div className="border-line overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-xs uppercase">
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Usuario</th>
              <th className="px-3 py-2 font-semibold">Acción</th>
              <th className="px-3 py-2 font-semibold">Sobre</th>
              <th className="px-3 py-2 font-semibold">Computadora</th>
              <th className="px-3 py-2 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-ink-muted px-3 py-6 text-center">
                  No hay registros con esos filtros.
                </td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    {row.userEmail ? (
                      <>
                        <span className="block font-medium">{row.userName}</span>
                        <span className="text-ink-muted text-xs">{row.userEmail}</span>
                      </>
                    ) : (
                      <span className="text-ink-muted">Sistema / sin cuenta</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block font-medium">{auditActionLabel(row.action)}</span>
                    <span className="text-ink-muted font-mono text-xs">{row.action}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block">{row.entity}</span>
                    {row.entityId && (
                      <span className="text-ink-muted font-mono text-xs break-all">
                        {row.entityId}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.deviceName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.details ? (
                      <pre className="max-w-xs overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                        {JSON.stringify(row.details, null, 1)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {result.totalPages > 1 && (
        <nav aria-label="Páginas" className="flex items-center gap-4 text-sm">
          {result.page > 1 && (
            <Link className="text-brand font-bold" href={pageHref(filters, result.page - 1)}>
              ← Anterior
            </Link>
          )}
          {result.page < result.totalPages && (
            <Link className="text-brand font-bold" href={pageHref(filters, result.page + 1)}>
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
