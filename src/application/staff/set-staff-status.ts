import {
  nextStaffStatus,
  type StaffStatusChange,
  statusChangeAllowedFrom,
} from "@/domain/staff/staff-rules";
import { DomainError } from "@/domain/shared/domain-error";

import type { AuditLogger } from "../shared/ports";
import type { StaffRepository } from "./ports";
import { findStaffOrFail, type StaffActor } from "./staff-shared";

export interface SetStaffStatusDeps {
  staff: StaffRepository;
  audit: AuditLogger;
}

/** Desactivar (cierra sus sesiones) o reactivar una cuenta del personal (RF-118). */
export function createSetStaffStatus(deps: SetStaffStatusDeps) {
  return async function setStaffStatus(
    actor: StaffActor,
    staffId: unknown,
    change: StaffStatusChange,
  ): Promise<void> {
    const account = await findStaffOrFail(deps.staff, staffId);
    const status = nextStaffStatus(account.status, change);

    const changed = await deps.staff.setStatus(account.id, statusChangeAllowedFrom(change), status);
    if (!changed) {
      throw new DomainError(
        "STATUS_CHANGED",
        "La cuenta cambió mientras tanto. Recarga la pantalla.",
      );
    }

    await deps.audit.log({
      userId: actor.id,
      action: change === "DEACTIVATE" ? "STAFF_ACCOUNT_DEACTIVATED" : "STAFF_ACCOUNT_REACTIVATED",
      entity: "user",
      entityId: account.id,
      details: { from: account.status, to: status },
    });
  };
}
