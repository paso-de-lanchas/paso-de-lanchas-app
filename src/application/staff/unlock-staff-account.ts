import { hasLoginLockout } from "@/domain/staff/staff-rules";
import { DomainError } from "@/domain/shared/domain-error";

import type { Clock } from "../shared/ports";
import type { StaffRepository } from "./ports";
import { findStaffOrFail, STAFF_NOT_FOUND, type StaffActor } from "./staff-shared";

export interface UnlockStaffAccountDeps {
  staff: StaffRepository;
  clock: Clock;
}

/** Quitar el bloqueo por intentos fallidos de un administrador o chofer (RF-118). */
export function createUnlockStaffAccount(deps: UnlockStaffAccountDeps) {
  return async function unlockStaffAccount(actor: StaffActor, staffId: unknown): Promise<void> {
    const account = await findStaffOrFail(deps.staff, staffId);
    if (!hasLoginLockout(account, deps.clock.now())) {
      throw new DomainError("NOT_LOCKED", "La cuenta no tiene intentos fallidos ni bloqueo.");
    }

    const unlocked = await deps.staff.unlock(account.id, {
      userId: actor.id,
      action: "STAFF_ACCOUNT_UNLOCKED",
      details: { failedLoginAttempts: account.failedLoginAttempts },
    });
    if (!unlocked) throw STAFF_NOT_FOUND;
  };
}
