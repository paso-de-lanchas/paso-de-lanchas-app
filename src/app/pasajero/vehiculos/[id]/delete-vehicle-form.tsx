"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/form-fields";

import { type DeleteVehicleState, removeVehicleAction } from "../actions";

const INITIAL_STATE: DeleteVehicleState = {};

export function DeleteVehicleForm({ vehicleId, plate }: { vehicleId: string; plate: string }) {
  const action = removeVehicleAction.bind(null, vehicleId);
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-red-200 bg-white p-5 shadow-xs"
    >
      <h2 className="font-heading text-base font-bold text-red-800">Eliminar vehículo</h2>
      <p className="text-ink-muted text-xs leading-relaxed">
        El vehículo con placas <span className="font-mono font-bold">{plate}</span> dejará de
        aparecer en tu galería. Tus abordajes anteriores conservarán su historial.
      </p>
      <FormAlert message={state.error} />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
      >
        {isPending ? "Eliminando vehículo…" : "Eliminar vehículo"}
      </button>
    </form>
  );
}
