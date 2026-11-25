"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ActiveVehicleType } from "@/application/vehicles/ports";
import { FieldError, FormAlert, inputClass, submitClass } from "@/components/form-fields";

import {
  addVehicleAction,
  updateVehicleAction,
  type VehicleFormState,
  type VehicleFormValues,
} from "./actions";

const INITIAL_STATE: VehicleFormState = {};

interface VehicleFormProps {
  mode: "create" | "edit";
  vehicleId?: string;
  vehicleTypes: ActiveVehicleType[];
  initialValues?: VehicleFormValues;
}

export function VehicleForm({ mode, vehicleId, vehicleTypes, initialValues }: VehicleFormProps) {
  const action =
    mode === "edit" && vehicleId ? updateVehicleAction.bind(null, vehicleId) : addVehicleAction;

  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? initialValues ?? {};

  return (
    <form
      action={formAction}
      className="border-line flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="vehicleTypeId" className="font-bold">
          Tipo de vehículo
        </label>
        <select
          id="vehicleTypeId"
          name="vehicleTypeId"
          defaultValue={values.vehicleTypeId ?? ""}
          required
          aria-invalid={!!errors.vehicleTypeId}
          aria-describedby={errors.vehicleTypeId ? "vehicleTypeId-error" : undefined}
          className={inputClass}
        >
          <option value="" disabled>
            Selecciona un tipo…
          </option>
          {vehicleTypes.map((type) => (
            <option key={type.id} value={String(type.id)}>
              {type.name}
            </option>
          ))}
        </select>
        <FieldError id="vehicleTypeId-error" message={errors.vehicleTypeId} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="brand" className="font-bold">
          Marca
        </label>
        <input
          id="brand"
          name="brand"
          type="text"
          defaultValue={values.brand ?? ""}
          placeholder="Ej. Nissan"
          maxLength={40}
          required
          aria-invalid={!!errors.brand}
          aria-describedby={errors.brand ? "brand-error" : undefined}
          className={inputClass}
        />
        <FieldError id="brand-error" message={errors.brand} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="model" className="font-bold">
          Modelo
        </label>
        <input
          id="model"
          name="model"
          type="text"
          defaultValue={values.model ?? ""}
          placeholder="Ej. Versa"
          maxLength={40}
          required
          aria-invalid={!!errors.model}
          aria-describedby={errors.model ? "model-error" : undefined}
          className={inputClass}
        />
        <FieldError id="model-error" message={errors.model} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="color" className="font-bold">
          Color
        </label>
        <input
          id="color"
          name="color"
          type="text"
          defaultValue={values.color ?? ""}
          placeholder="Ej. Blanco"
          maxLength={30}
          required
          aria-invalid={!!errors.color}
          aria-describedby={errors.color ? "color-error" : undefined}
          className={inputClass}
        />
        <FieldError id="color-error" message={errors.color} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="plate" className="font-bold">
          Placas
        </label>
        <input
          id="plate"
          name="plate"
          type="text"
          defaultValue={values.plate ?? ""}
          placeholder="Ej. YXZ123A"
          maxLength={15}
          required
          aria-invalid={!!errors.plate}
          aria-describedby="plate-help plate-error"
          className={`${inputClass} uppercase`}
        />
        <span id="plate-help" className="text-ink-muted text-xs">
          Se guardan en mayúsculas y sin espacios ni guiones.
        </span>
        <FieldError id="plate-error" message={errors.plate} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="photoUrl" className="font-bold">
          Fotografía (opcional)
        </label>
        <input
          id="photoUrl"
          name="photoUrl"
          type="url"
          defaultValue={values.photoUrl ?? ""}
          placeholder="https://..."
          aria-invalid={!!errors.photoUrl}
          aria-describedby={errors.photoUrl ? "photoUrl-error" : undefined}
          className={inputClass}
        />
        <FieldError id="photoUrl-error" message={errors.photoUrl} />
      </div>

      <FormAlert message={state.error} />

      <button type="submit" disabled={isPending} className={submitClass}>
        {isPending
          ? mode === "edit"
            ? "Guardando cambios…"
            : "Registrando vehículo…"
          : mode === "edit"
            ? "Guardar cambios"
            : "Registrar vehículo"}
      </button>

      {mode === "edit" ? (
        <Link
          href="/pasajero/vehiculos"
          className="border-line text-ink-muted hover:text-ink rounded-xl border px-4 py-2.5 text-center text-sm font-semibold transition"
        >
          Cancelar
        </Link>
      ) : null}
    </form>
  );
}
