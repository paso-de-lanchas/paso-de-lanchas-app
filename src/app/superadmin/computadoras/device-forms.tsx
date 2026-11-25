"use client";

import { useActionState } from "react";

import type { DockOption } from "@/application/staff/ports";
import { FieldError, FormAlert, inputClass } from "@/components/form-fields";

import {
  approveDeviceAction,
  type DeviceActionState,
  renameDeviceAction,
  revokeDeviceAction,
} from "./actions";

const primaryClass =
  "bg-brand rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60";
const dangerClass =
  "rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-60";

function Done({ state }: { state: DeviceActionState }) {
  return (
    <>
      <FormAlert message={state.error} />
      {state.done && (
        <p role="status" className="text-success-ink text-sm font-bold">
          {state.done}
        </p>
      )}
    </>
  );
}

interface ApproveFormProps {
  deviceId: string;
  name: string;
  dockId: string | null;
  /** La del superadministrador puede ser de oficina; la de un administrador, no. */
  allowOffice: boolean;
  docks: DockOption[];
}

/** Aprobar asignando nombre y muelle, o rechazar la solicitud. */
export function ApproveDeviceForm({
  deviceId,
  name,
  dockId,
  allowOffice,
  docks,
}: ApproveFormProps) {
  const [state, approve, approving] = useActionState<DeviceActionState, FormData>(
    approveDeviceAction.bind(null, deviceId),
    {},
  );
  const [rejectState, reject, rejecting] = useActionState<DeviceActionState, FormData>(
    revokeDeviceAction.bind(null, deviceId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const nameId = `name-${deviceId}`;
  const dockFieldId = `dock-${deviceId}`;

  return (
    <div className="flex flex-col gap-3">
      <form action={approve} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-sm font-bold">
            Nombre
          </label>
          <input
            id={nameId}
            name="name"
            defaultValue={name}
            required
            maxLength={60}
            aria-invalid={!!errors.name}
            aria-describedby={`${nameId}-error`}
            className={inputClass}
          />
          <FieldError id={`${nameId}-error`} message={errors.name} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={dockFieldId} className="text-sm font-bold">
            Muelle
          </label>
          <select
            id={dockFieldId}
            name="dockId"
            defaultValue={dockId ?? ""}
            required={!allowOffice}
            aria-invalid={!!errors.dockId}
            aria-describedby={`${dockFieldId}-error`}
            className={inputClass}
          >
            {allowOffice ? (
              <option value="">Oficina (sin muelle)</option>
            ) : (
              <option value="" disabled>
                Elige un muelle
              </option>
            )}
            {docks.map((dock) => (
              <option key={dock.id} value={dock.id}>
                {dock.name}
              </option>
            ))}
          </select>
          <FieldError id={`${dockFieldId}-error`} message={errors.dockId} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={approving} className={primaryClass}>
            Aprobar
          </button>
          <button type="submit" formAction={reject} disabled={rejecting} className={dangerClass}>
            Rechazar
          </button>
        </div>
      </form>
      <Done state={state} />
      <Done state={rejectState} />
    </div>
  );
}

/** Renombrar o revocar una computadora aprobada. */
export function ApprovedDeviceForms({ deviceId, name }: { deviceId: string; name: string }) {
  const [renameState, rename, renaming] = useActionState<DeviceActionState, FormData>(
    renameDeviceAction.bind(null, deviceId),
    {},
  );
  const [revokeState, revoke, revoking] = useActionState<DeviceActionState, FormData>(
    revokeDeviceAction.bind(null, deviceId),
    {},
  );
  const nameId = `rename-${deviceId}`;

  return (
    <div className="flex flex-col gap-3">
      <form action={rename} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-sm font-bold">
            Nombre
          </label>
          <input
            id={nameId}
            name="name"
            defaultValue={name}
            required
            maxLength={60}
            aria-invalid={!!renameState.fieldErrors?.name}
            aria-describedby={`${nameId}-error`}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={renaming} className={primaryClass}>
          Guardar nombre
        </button>
      </form>
      <FieldError id={`${nameId}-error`} message={renameState.fieldErrors?.name} />
      <Done state={renameState} />
      <form action={revoke}>
        <button type="submit" disabled={revoking} className={dangerClass}>
          Revocar acceso
        </button>
      </form>
      <Done state={revokeState} />
    </div>
  );
}
