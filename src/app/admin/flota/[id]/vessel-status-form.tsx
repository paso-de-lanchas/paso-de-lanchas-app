"use client";

import { useActionState } from "react";
import { getVesselState, type VesselStatus } from "@/domain/fleet/vessel-status";
import { changeVesselStatusAction, type VesselStatusActionState } from "../actions";

const STATUS_LABELS: Record<VesselStatus, string> = {
  ACTIVE: "Activa",
  MAINTENANCE: "En mantenimiento",
  SEIZED: "Embargada",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const initialState: VesselStatusActionState = {
  error: null,
  success: null,
};

interface VesselStatusFormProps {
  vesselId: string;
  currentStatus: VesselStatus;
}

export function VesselStatusForm({ vesselId, currentStatus }: VesselStatusFormProps) {
  const boundAction = changeVesselStatusAction.bind(null, vesselId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const availableStatuses = getVesselState(currentStatus).allowedTransitions();

  return (
    <form
      action={formAction}
      className="border-line space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="font-heading text-ink text-lg font-semibold">Cambiar estado</h2>
        <p className="text-ink-muted text-sm">
          Estado actual:{" "}
          <span className="text-ink font-semibold">{STATUS_LABELS[currentStatus]}</span>. Indica el
          nuevo estado y el motivo obligatorio del cambio.
        </p>
      </div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div
          role="status"
          className="border-success-bg bg-success-bg/60 text-success-ink rounded-xl border px-4 py-3 text-sm font-medium"
        >
          {state.success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="toStatus" className="text-ink mb-1.5 block text-sm font-medium">
            Nuevo estado
          </label>
          <select
            id="toStatus"
            name="toStatus"
            required
            defaultValue={availableStatuses[0] ?? ""}
            className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status-reason" className="text-ink mb-1.5 block text-sm font-medium">
            Motivo del cambio (obligatorio)
          </label>
          <input
            id="status-reason"
            name="reason"
            type="text"
            required
            minLength={3}
            maxLength={500}
            placeholder="Ej. Revisión preventiva de motor o liberación de trámite"
            className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || availableStatuses.length === 0}
          className="bg-brand hover:bg-brand-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {isPending ? "Guardando estado..." : "Cambiar estado"}
        </button>
      </div>
    </form>
  );
}
