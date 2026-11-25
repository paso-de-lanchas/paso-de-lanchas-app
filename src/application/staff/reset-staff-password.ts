import type { Mailer, PasswordHasher } from "../auth/ports";
import type { AuditLogger } from "../shared/ports";
import { staffPasswordResetEmail } from "./emails";
import type { StaffRepository } from "./ports";
import {
  findStaffOrFail,
  sendWithoutFailing,
  STAFF_NOT_FOUND,
  type StaffActor,
} from "./staff-shared";

export interface ResetStaffPasswordDeps {
  staff: StaffRepository;
  hasher: PasswordHasher;
  generatePassword: () => string;
  mailer: Mailer;
  audit: AuditLogger;
  appUrl: string;
}

export interface StaffPasswordReset {
  temporaryPassword: string;
  emailSent: boolean;
}

/**
 * Restablecer la contraseña de un administrador o chofer con una temporal nueva (RF-119).
 * Cierra todas sus sesiones y lo obliga a cambiarla al entrar (RF-013).
 */
export function createResetStaffPassword(deps: ResetStaffPasswordDeps) {
  return async function resetStaffPassword(
    actor: StaffActor,
    staffId: unknown,
  ): Promise<StaffPasswordReset> {
    const account = await findStaffOrFail(deps.staff, staffId);
    const temporaryPassword = deps.generatePassword();

    const reset = await deps.staff.resetPassword(
      account.id,
      await deps.hasher.hash(temporaryPassword),
      { userId: actor.id, action: "STAFF_PASSWORD_RESET" },
    );
    if (!reset) throw STAFF_NOT_FOUND;
    const emailSent = await sendWithoutFailing(
      deps.mailer,
      deps.audit,
      actor,
      account,
      staffPasswordResetEmail(account.email, account.fullName, deps.appUrl, temporaryPassword),
    );
    return { temporaryPassword, emailSent };
  };
}
