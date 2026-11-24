import type { Role } from "@/domain/auth/roles";
import { DomainError } from "@/domain/shared/domain-error";

/**
 * Cuentas del personal (RF-116 a RF-119). El superadministrador solo crea y administra
 * administradores y choferes: nunca a otro superadministrador ni a sí mismo, ni a pasajeros.
 */
export const STAFF_ROLES = ["ADMIN", "DRIVER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Estados de una cuenta (coinciden con el enum `user_status`). */
export const ACCOUNT_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "BLOCKED", "INACTIVE"] as const;
export type AccountStatusCode = (typeof ACCOUNT_STATUSES)[number];

export function isStaffRole(role: Role): role is StaffRole {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

/** El administrador cobra en un muelle: lo necesita. El chofer no tiene muelle fijo. */
export function staffDockFor(role: StaffRole, dockId: string | null): string | null {
  if (role === "DRIVER") return null;
  if (!dockId) throw new DomainError("DOCK_REQUIRED", "El administrador necesita un muelle.");
  return dockId;
}

export type StaffStatusChange = "DEACTIVATE" | "REACTIVATE";

/** Desde qué estados se puede desactivar o reactivar una cuenta del personal. */
const ALLOWED_FROM: Record<StaffStatusChange, readonly AccountStatusCode[]> = {
  DEACTIVATE: ["ACTIVE", "BLOCKED"],
  REACTIVATE: ["INACTIVE", "BLOCKED"],
};

export function statusChangeAllowedFrom(change: StaffStatusChange): readonly AccountStatusCode[] {
  return ALLOWED_FROM[change];
}

export function nextStaffStatus(
  current: AccountStatusCode,
  change: StaffStatusChange,
): "ACTIVE" | "INACTIVE" {
  if (!ALLOWED_FROM[change].includes(current)) {
    throw new DomainError(
      "STATUS_UNCHANGED",
      change === "DEACTIVATE" ? "La cuenta ya está desactivada." : "La cuenta ya está activa.",
    );
  }
  return change === "DEACTIVATE" ? "INACTIVE" : "ACTIVE";
}

/** La cuenta tiene un bloqueo por intentos fallidos que el superadministrador puede quitar. */
export function hasLoginLockout(
  account: { failedLoginAttempts: number; lockedUntil: Date | null },
  now: Date,
): boolean {
  return account.failedLoginAttempts > 0 || (!!account.lockedUntil && account.lockedUntil > now);
}
