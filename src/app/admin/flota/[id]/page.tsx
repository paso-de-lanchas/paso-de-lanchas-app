import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { VesselStatus } from "@/domain/fleet/vessel-status";
import { createGetVesselHistory } from "@/application/fleet/get-vessel-history";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaVesselRepository } from "@/infrastructure/fleet/prisma-vessel-repository";
import { PrismaVesselStatusRepository } from "@/infrastructure/fleet/prisma-vessel-status.repository";
import { requireRole } from "@/lib/auth/require-role";
import { updateVesselAction } from "../actions";
import { VesselForm } from "../vessel-form";
import { VesselStatusForm } from "./vessel-status-form";

export const metadata: Metadata = {
  title: "Editar embarcación | Administrador",
};

const uuidSchema = z.string().uuid();

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

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

interface EditarEmbarcacionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEmbarcacionPage({ params }: EditarEmbarcacionPageProps) {
  await requireRole("ADMIN", "SUPERADMIN");

  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const vesselRepo = new PrismaVesselRepository(prisma);
  const statusRepo = new PrismaVesselStatusRepository(prisma);
  const getVesselHistory = createGetVesselHistory(statusRepo);

  const [vessel, vehicleTypes, history] = await Promise.all([
    vesselRepo.findById(parsedId.data),
    vesselRepo.listVehicleTypes(),
    getVesselHistory(parsedId.data),
  ]);

  if (!vessel) {
    notFound();
  }

  const boundUpdateAction = updateVesselAction.bind(null, vessel.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wider uppercase">
            Flota · {vessel.code}
          </p>
          <h1 className="font-heading text-ink text-2xl font-bold">Editar {vessel.name}</h1>
        </div>

        <Link href="/admin/flota" className="text-brand text-sm font-medium hover:underline">
          ← Volver a flota
        </Link>
      </div>

      <VesselForm
        mode="edit"
        initialVessel={vessel}
        vehicleTypes={vehicleTypes}
        action={boundUpdateAction}
      />

      <VesselStatusForm vesselId={vessel.id} currentStatus={vessel.status} />

      <section className="border-line space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-heading text-ink text-lg font-semibold">Historial de estados</h2>
          <p className="text-ink-muted text-sm">
            Registro de cambios de estado, responsable, motivo y fecha.
          </p>
        </div>

        {history.statusHistory.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Aún no hay cambios de estado registrados para esta embarcación.
          </p>
        ) : (
          <div className="border-line overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-line bg-surface/70 text-ink-muted border-b text-xs uppercase">
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">De</th>
                  <th className="px-4 py-3 font-semibold">A</th>
                  <th className="px-4 py-3 font-semibold">Quién</th>
                  <th className="px-4 py-3 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {history.statusHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface/40">
                    <td className="text-ink px-4 py-3 whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(entry.changedAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[entry.fromStatus]}`}
                      >
                        {STATUS_LABELS[entry.fromStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[entry.fromStatus]}`}
                      >
                        {STATUS_LABELS[entry.toStatus]}
                      </span>
                    </td>
                    <td className="text-ink px-4 py-3">
                      {entry.changedByName ?? entry.changedById}
                    </td>
                    <td className="text-ink px-4 py-3">{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
