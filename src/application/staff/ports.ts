import type { AccountStatusCode, StaffRole } from "@/domain/staff/staff-rules";

import type { ChangeAudit } from "../shared/ports";

/** Puertos del módulo de cuentas del personal (RF-116 a RF-119). */

/** Cuenta de administrador o chofer, sin el hash de la contraseña. */
export interface StaffAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: StaffRole;
  status: AccountStatusCode;
  dockId: string | null;
  dockName: string | null;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export interface StaffFilter {
  role?: StaffRole;
  status?: AccountStatusCode;
}

export interface DockOption {
  id: string;
  name: string;
}

export interface NewStaffAccount {
  email: string;
  fullName: string;
  phone: string;
  role: StaffRole;
  dockId: string | null;
  passwordHash: string;
  createdAt: Date;
}

export interface StaffRepository {
  /** Solo administradores y choferes no eliminados (nunca superadministradores ni pasajeros). */
  list(filter: StaffFilter): Promise<StaffAccount[]>;
  /** Administrador o chofer no eliminado; null si el id es de otro rol o no existe. */
  findStaff(id: string): Promise<StaffAccount | null>;
  listDocks(): Promise<DockOption[]>;
  dockExists(dockId: string): Promise<boolean>;
  /*
   * Las operaciones que cambian una cuenta reciben su evento de bitácora y lo guardan en la
   * misma transacción (entidad "user", id de la cuenta): o quedan las dos cosas o ninguna.
   */
  /**
   * Crea la cuenta ACTIVE, con el correo ya confirmado y `must_change_password`.
   * Devuelve null (sin registrar nada) si el correo ya lo usa otra cuenta.
   */
  create(account: NewStaffAccount, audit: ChangeAudit): Promise<{ id: string } | null>;
  /**
   * Cambia el estado solo si la cuenta sigue en uno de `from` (false si otra petición lo
   * cambió antes). Al pasar a INACTIVE borra sus sesiones en la misma transacción.
   */
  setStatus(
    id: string,
    from: readonly AccountStatusCode[],
    to: "ACTIVE" | "INACTIVE",
    audit: ChangeAudit,
  ): Promise<boolean>;
  /** Quita el bloqueo por intentos: contador en 0 y sin `locked_until`. False si no existe. */
  unlock(id: string, audit: ChangeAudit): Promise<boolean>;
  /**
   * En una transacción: guarda la contraseña temporal, marca `must_change_password`, quita el
   * bloqueo por intentos, invalida sus enlaces de recuperación y borra todas sus sesiones.
   * False si la cuenta no existe.
   */
  resetPassword(id: string, passwordHash: string, audit: ChangeAudit): Promise<boolean>;
}
