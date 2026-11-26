"use client";

import Image from "next/image";
import { useActionState, useTransition } from "react";
import {
  assignDriverAction,
  unassignDriverAction,
  updateDriverAction,
  type DriverActionState,
} from "../actions";
import type { AssignableVessel, DriverSummary } from "@/application/drivers/ports";

const INITIAL_STATE: DriverActionState = { error: null, success: null };

interface DriverDetailClientProps {
  driver: DriverSummary;
  vessels: AssignableVessel[];
}

export function DriverDetailClient({ driver, vessels }: DriverDetailClientProps) {
  const [profileState, profileAction, isSavingProfile] = useActionState(
    updateDriverAction.bind(null, driver.id),
    INITIAL_STATE,
  );
  const [assignState, assignAction, isAssigning] = useActionState(
    assignDriverAction.bind(null, driver.id),
    INITIAL_STATE,
  );
  const [isUnassigning, startUnassignTransition] = useTransition();

  const activeVesselIds = new Set(driver.activeAssignments.map((a) => a.vesselId));
  const availableVessels = vessels.filter((v) => !activeVesselIds.has(v.id));

  function handleUnassign(assignmentId: string) {
    startUnassignTransition(async () => {
      await unassignDriverAction(driver.id, assignmentId);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="border-line space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {driver.photoUrl ? (
            <Image
              src={driver.photoUrl}
              alt={driver.fullName}
              width={56}
              height={56}
              unoptimized
              className="border-line h-14 w-14 rounded-full border object-cover"
            />
          ) : (
            <div className="bg-surface text-brand flex h-14 w-14 items-center justify-center rounded-full text-base font-bold">
              {driver.fullName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-heading text-ink text-lg font-bold">Datos del chofer</h2>
            <p className="text-ink-muted text-xs">{driver.email}</p>
          </div>
        </div>

        <form action={profileAction} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="text-ink mb-1 block text-xs font-semibold">
              Nombre completo
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              defaultValue={driver.fullName}
              className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone" className="text-ink mb-1 block text-xs font-semibold">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              defaultValue={driver.phone ?? ""}
              placeholder="Ej. 9211234567"
              className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="photoUrl" className="text-ink mb-1 block text-xs font-semibold">
              URL de fotografía
            </label>
            <input
              id="photoUrl"
              name="photoUrl"
              type="text"
              defaultValue={driver.photoUrl ?? ""}
              placeholder="https://... o /images/chofer.jpg"
              className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          {profileState.error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {profileState.error}
            </p>
          ) : null}

          {profileState.success ? (
            <p className="bg-success-bg text-success-ink rounded-xl px-3 py-2 text-xs font-medium">
              {profileState.success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSavingProfile}
            className="bg-brand hover:bg-brand-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSavingProfile ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      <section className="border-line space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-heading text-ink text-lg font-bold">Asignar embarcación</h2>
          <p className="text-ink-muted text-xs">
            Asigna una embarcación activa al chofer o retira asignaciones vigentes.
          </p>
        </div>

        <form action={assignAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="vesselId" className="text-ink mb-1 block text-xs font-semibold">
              Embarcación
            </label>
            <select
              id="vesselId"
              name="vesselId"
              defaultValue=""
              className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecciona una embarcación...
              </option>
              {availableVessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name} ({v.status})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isAssigning || availableVessels.length === 0}
            className="bg-brand hover:bg-brand-accent rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isAssigning ? "Asignando..." : "Asignar"}
          </button>
        </form>

        {assignState.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {assignState.error}
          </p>
        ) : null}

        {assignState.success ? (
          <p className="bg-success-bg text-success-ink rounded-xl px-3 py-2 text-xs font-medium">
            {assignState.success}
          </p>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-ink text-xs font-semibold uppercase">Historial de asignaciones</h3>
          {driver.assignmentHistory.length === 0 ? (
            <p className="text-ink-muted text-xs">Sin asignaciones registradas.</p>
          ) : (
            <ul className="divide-line divide-y text-xs">
              {driver.assignmentHistory.map((item) => {
                const isActive = item.unassignedAt === null;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <span className="text-ink font-semibold">
                        {item.vesselCode} · {item.vesselName}
                      </span>
                      <div className="text-ink-muted">
                        Alta: {new Date(item.assignedAt).toLocaleString("es-MX")}
                        {item.unassignedAt
                          ? ` · Baja: ${new Date(item.unassignedAt).toLocaleString("es-MX")}`
                          : " · Activa"}
                      </div>
                    </div>
                    {isActive ? (
                      <button
                        type="button"
                        disabled={isUnassigning}
                        onClick={() => handleUnassign(item.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Retirar
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
