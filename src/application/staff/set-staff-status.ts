import {
  nextStaffStatus,
  type StaffStatusChange,
  statusChangeAllowedFrom,
} from "@/domain/staff/staff-rules";
import { DomainError } from "@/domain/shared/domain-error";

import type { StaffRepository } from "./ports";
import { staffStatusChangeSchema } from "./staff-input";
import { findStaffOrFail, type StaffActor } from "./staff-shared";

export interface SetStaffStatusDeps {
  staff: StaffRepository;
}

export const INVALID_STATUS_CHANGE = new DomainError(
  "INVALID_STATUS_CHANGE",
  "La acción no es válida. Recarga la pantalla e inténtalo de nuevo.",
);

/**
 * Desactivar (cierra sus sesiones) o reactivar una cuenta del personal (RF-118). `change` llega
 * del formulario: solo se acepta DEACTIVATE o REACTIVATE; cualquier otro valor no cambia nada.
 * Devuelve el cambio que se aplicó.
 */
export function createSetStaffStatus(deps: SetStaffStatusDeps) {
  return async function setStaffStatus(
    actor: StaffActor,
    staffId: unknown,
    rawChange: unknown,
  ): Promise<StaffStatusChange> {
    const parsed = staffStatusChangeSchema.safeParse(rawChange);
    if (!parsed.success) throw INVALID_STATUS_CHANGE;
    const change = parsed.data;

    const account = await findStaffOrFail(deps.staff, staffId);
    const status = nextStaffStatus(account.status, change);

    const changed = await deps.staff.setStatus(
      account.id,
      statusChangeAllowedFrom(change),
      status,
      {
        userId: actor.id,
        action: change === "DEACTIVATE" ? "STAFF_ACCOUNT_DEACTIVATED" : "STAFF_ACCOUNT_REACTIVATED",
        details: { from: account.status, to: status },
      },
    );
    if (!changed) {
      throw new DomainError(
        "STATUS_CHANGED",
        "La cuenta cambió mientras tanto. Recarga la pantalla.",
      );
    }
    return change;
  };
}
