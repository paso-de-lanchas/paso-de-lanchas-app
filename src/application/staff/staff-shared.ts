import { DomainError } from "@/domain/shared/domain-error";

import type { EmailMessage, Mailer } from "../auth/ports";
import type { AuditLogger } from "../shared/ports";
import type { StaffAccount, StaffRepository } from "./ports";
import { staffIdSchema } from "./staff-input";

/** Quién hace la acción: siempre un superadministrador con sesión (lo verifica `assertRole`). */
export interface StaffActor {
  id: string;
}

export const STAFF_NOT_FOUND = new DomainError(
  "STAFF_NOT_FOUND",
  "No existe una cuenta de administrador o chofer con ese identificador.",
);

/**
 * La cuenta a administrar. Solo administradores y choferes: un superadministrador (incluido
 * quien hace la acción) o un pasajero se tratan como si no existieran.
 */
export async function findStaffOrFail(staff: StaffRepository, id: unknown): Promise<StaffAccount> {
  const parsed = staffIdSchema.safeParse(id);
  if (!parsed.success) throw STAFF_NOT_FOUND;
  const account = await staff.findStaff(parsed.data);
  if (!account) throw STAFF_NOT_FOUND;
  return account;
}

/**
 * Manda el correo sin detener la operación: si el servidor de correo falla, la contraseña
 * temporal igual se muestra en pantalla. Devuelve si se envió.
 */
export async function sendWithoutFailing(
  mailer: Mailer,
  audit: AuditLogger,
  actor: StaffActor,
  account: { id: string },
  message: EmailMessage,
): Promise<boolean> {
  try {
    await mailer.send(message);
    return true;
  } catch {
    await audit.log({
      userId: actor.id,
      action: "STAFF_EMAIL_FAILED",
      entity: "user",
      entityId: account.id,
      details: { subject: message.subject },
    });
    return false;
  }
}
