"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { VesselKind } from "@/domain/fleet/vessel";
import type { VehicleTypeOption, VesselDetail } from "@/application/fleet/vessel-ports";
import type { VesselActionState } from "./actions";

interface VesselFormProps {
  mode: "create" | "edit";
  vehicleTypes: VehicleTypeOption[];
  initialVessel?: VesselDetail;
  action: (prevState: VesselActionState, formData: FormData) => Promise<VesselActionState>;
}

const INITIAL_STATE: VesselActionState = { error: null };

export function VesselForm({ mode, vehicleTypes, initialVessel, action }: VesselFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [kind, setKind] = useState<VesselKind>(initialVessel?.kind ?? "BOAT");

  const capacityMap = new Map<number, number>(
    (initialVessel?.vehicleCapacities ?? []).map((vc) => [vc.vehicleTypeId, vc.capacity]),
  );

  return (
    <form
      action={formAction}
      className="border-line space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
    >
      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className="text-ink mb-1.5 block text-sm font-medium">
            Código *
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            maxLength={10}
            defaultValue={initialVessel?.code ?? ""}
            placeholder="Ej. L-01 o T-01"
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label htmlFor="registration" className="text-ink mb-1.5 block text-sm font-medium">
            Matrícula *
          </label>
          <input
            id="registration"
            name="registration"
            type="text"
            required
            maxLength={30}
            defaultValue={initialVessel?.registration ?? ""}
            placeholder="Ej. VER-1234-A"
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="name" className="text-ink mb-1.5 block text-sm font-medium">
            Nombre de la embarcación *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            defaultValue={initialVessel?.name ?? ""}
            placeholder="Ej. Lancha Coatzacoalcos I"
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label htmlFor="kind" className="text-ink mb-1.5 block text-sm font-medium">
            Tipo de embarcación *
          </label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as VesselKind)}
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          >
            <option value="BOAT">Lancha</option>
            <option value="FERRY">Transbordador</option>
          </select>
        </div>

        <div>
          <label htmlFor="passengerCapacity" className="text-ink mb-1.5 block text-sm font-medium">
            Capacidad de pasajeros *
          </label>
          <input
            id="passengerCapacity"
            name="passengerCapacity"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={initialVessel?.passengerCapacity ?? ""}
            placeholder="Ej. 30"
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label htmlFor="color" className="text-ink mb-1.5 block text-sm font-medium">
            Color
          </label>
          <input
            id="color"
            name="color"
            type="text"
            maxLength={30}
            defaultValue={initialVessel?.color ?? ""}
            placeholder="Ej. Blanco con franja azul"
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>

        <div>
          <label htmlFor="photoUrl" className="text-ink mb-1.5 block text-sm font-medium">
            URL de fotografía (https://)
          </label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="url"
            defaultValue={initialVessel?.photoUrl ?? ""}
            placeholder="https://..."
            className="border-line text-ink focus:border-brand w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none"
          />
        </div>
      </div>

      {kind === "FERRY" ? (
        <fieldset className="border-line bg-surface/60 space-y-4 rounded-xl border p-4">
          <legend className="text-ink px-2 text-sm font-semibold">
            Capacidad por tipo de vehículo (Transbordador)
          </legend>

          {vehicleTypes.length === 0 ? (
            <p className="text-ink-muted text-sm">
              No hay tipos de vehículo activos registrados en la base de datos.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {vehicleTypes.map((vt) => (
                <div key={vt.id}>
                  <label
                    htmlFor={`vehicleCapacity_${vt.id}`}
                    className="text-ink mb-1 block text-xs font-medium"
                  >
                    {vt.name}
                  </label>
                  <input
                    id={`vehicleCapacity_${vt.id}`}
                    name={`vehicleCapacity_${vt.id}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={capacityMap.get(vt.id) ?? 0}
                    className="border-line text-ink focus:border-brand w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      <div className="border-line flex items-center justify-end gap-3 border-t pt-4">
        <Link
          href="/admin/flota"
          className="border-line text-ink hover:bg-surface rounded-xl border px-4 py-2.5 text-sm font-medium"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand hover:bg-brand-accent rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {isPending
            ? "Guardando..."
            : mode === "create"
              ? "Registrar embarcación"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
