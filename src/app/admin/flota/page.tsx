import type { Metadata } from "next";
import Link from "next/link";
import {
  VESSEL_KINDS,
  VESSEL_STATUSES,
  type VesselKind,
  type VesselStatus,
} from "@/domain/fleet/vessel";
import { createListVessels } from "@/application/fleet/list-vessels";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaVesselRepository } from "@/infrastructure/fleet/prisma-vessel-repository";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Flota | Administrador" };

const KIND_LABELS: Record<VesselKind, string> = {
  BOAT: "Lancha",
  FERRY: "Transbordador",
};

const STATUS_LABELS: Record<VesselStatus, string> = {
  ACTIVE: "Activa",
  MAINTENANCE: "En mantenimiento",
  SEIZED: "Embargada",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const STATUS_STYLES: Record<VesselStatus, string> = {
  ACTIVE: "bg-success-bg text-success-ink",
  MAINTENANCE: "bg-amber-100 text-amber-900",
  SEIZED: "bg-red-100 text-red-900",
  OUT_OF_SERVICE: "bg-slate-200 text-slate-800",
};

interface FlotaPageProps {
  searchParams: Promise<{ kind?: string; status?: string }>;
}

export default async function FlotaPage({ searchParams }: FlotaPageProps) {
  await requireRole("ADMIN", "SUPERADMIN");

  const params = await searchParams;
  const kindFilter = VESSEL_KINDS.includes(params.kind as VesselKind)
    ? (params.kind as VesselKind)
    : undefined;
  const statusFilter = VESSEL_STATUSES.includes(params.status as VesselStatus)
    ? (params.status as VesselStatus)
    : undefined;

  const repo = new PrismaVesselRepository(prisma);
  const listVessels = createListVessels(repo);
  const vessels = await listVessels({
    kind: kindFilter,
    status: statusFilter,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wider uppercase">
            Administración de flota
          </p>
          <h1 className="font-heading text-ink text-2xl font-bold">
            Embarcaciones ({vessels.length})
          </h1>
        </div>

        <Link
          href="/admin/flota/nueva"
          className="bg-brand hover:bg-brand-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
        >
          + Nueva embarcación
        </Link>
      </div>

      <form
        method="GET"
        className="border-line flex flex-wrap items-end gap-4 rounded-2xl border bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="filter-kind" className="text-ink-muted mb-1 block text-xs font-medium">
            Tipo
          </label>
          <select
            id="filter-kind"
            name="kind"
            defaultValue={kindFilter ?? ""}
            className="border-line text-ink rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="BOAT">Lancha</option>
            <option value="FERRY">Transbordador</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="text-ink-muted mb-1 block text-xs font-medium">
            Estado
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={statusFilter ?? ""}
            className="border-line text-ink rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {VESSEL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-brand hover:bg-brand-accent rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          Filtrar
        </button>

        {kindFilter || statusFilter ? (
          <Link
            href="/admin/flota"
            className="border-line text-ink hover:bg-surface rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Limpiar filtros
          </Link>
        ) : null}
      </form>

      {vessels.length === 0 ? (
        <div className="border-line text-ink-muted rounded-2xl border bg-white p-8 text-center text-sm">
          No hay embarcaciones que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="border-line overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-line bg-surface/70 text-ink-muted border-b text-xs uppercase">
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Matrícula</th>
                <th className="px-4 py-3 font-semibold">Capacidad</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {vessels.map((vessel) => (
                <tr key={vessel.id} className="hover:bg-surface/40">
                  <td className="text-ink px-4 py-3 font-mono font-semibold">{vessel.code}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink font-medium">{vessel.name}</div>
                    {vessel.color ? (
                      <div className="text-ink-muted text-xs">Color: {vessel.color}</div>
                    ) : null}
                  </td>
                  <td className="text-ink px-4 py-3">{KIND_LABELS[vessel.kind]}</td>
                  <td className="text-ink px-4 py-3 font-mono text-xs">{vessel.registration}</td>
                  <td className="text-ink px-4 py-3">
                    <div>{vessel.passengerCapacity} pasajeros</div>
                    {vessel.kind === "FERRY" && vessel.vehicleCapacities.length > 0 ? (
                      <div className="text-ink-muted mt-0.5 text-xs">
                        {vessel.vehicleCapacities
                          .map((vc) => `${vc.vehicleTypeName}: ${vc.capacity}`)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[vessel.status]}`}
                    >
                      {STATUS_LABELS[vessel.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/flota/${vessel.id}`}
                      className="border-line text-brand hover:bg-surface rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    >
                      Editar
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
