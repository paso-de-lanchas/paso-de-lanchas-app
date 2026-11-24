import { staffDockFor } from "@/domain/staff/staff-rules";

import type { Mailer, PasswordHasher } from "../auth/ports";
import { InputError, parseInput } from "../shared/input-error";
import type { AuditLogger, Clock } from "../shared/ports";
import { staffWelcomeEmail } from "./emails";
import type { StaffRepository } from "./ports";
import { type NewStaffField, type NewStaffInput, newStaffSchema } from "./staff-input";
import { sendWithoutFailing, type StaffActor } from "./staff-shared";

export interface CreateStaffAccountDeps {
  staff: StaffRepository;
  hasher: PasswordHasher;
  generatePassword: () => string;
  mailer: Mailer;
  audit: AuditLogger;
  clock: Clock;
  appUrl: string;
}

export interface CreatedStaffAccount {
  id: string;
  /** En claro solo aquí, para mostrarla una vez. En la base solo queda su hash. */
  temporaryPassword: string;
  emailSent: boolean;
}

/**
 * Crear una cuenta de administrador (con muelle) o de chofer (RF-116, RF-117). Nace activa,
 * con una contraseña temporal que se debe cambiar al primer inicio de sesión (RF-013).
 */
export function createCreateStaffAccount(deps: CreateStaffAccountDeps) {
  return async function createStaffAccount(
    actor: StaffActor,
    input: NewStaffInput,
  ): Promise<CreatedStaffAccount> {
    const data = parseInput<NewStaffField, typeof newStaffSchema>(newStaffSchema, input);
    const dockId = staffDockFor(data.role, data.dockId);
    if (dockId && !(await deps.staff.dockExists(dockId))) {
      throw new InputError<NewStaffField>({ dockId: "Elige un muelle de la lista." });
    }

    const temporaryPassword = deps.generatePassword();
    const created = await deps.staff.create({
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
      dockId,
      passwordHash: await deps.hasher.hash(temporaryPassword),
      createdAt: deps.clock.now(),
    });
    if (!created) {
      throw new InputError<NewStaffField>({ email: "Ya existe una cuenta con ese correo." });
    }

    await deps.audit.log({
      userId: actor.id,
      action: "STAFF_ACCOUNT_CREATED",
      entity: "user",
      entityId: created.id,
      details: { role: data.role, dockId },
    });
    const emailSent = await sendWithoutFailing(
      deps.mailer,
      deps.audit,
      actor,
      created,
      staffWelcomeEmail(data.email, data.fullName, data.role, deps.appUrl, temporaryPassword),
    );
    return { id: created.id, temporaryPassword, emailSent };
  };
}
