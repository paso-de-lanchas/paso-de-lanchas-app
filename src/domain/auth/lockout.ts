import type { Role } from "./roles";

/**
 * Bloqueo temporal por intentos fallidos (RF-010). Aplica al personal; el pasajero no se
 * bloquea para que nadie pueda dejarlo sin abordar escribiendo mal su contraseña a propósito.
 */
export const DEFAULT_MAX_FAILED_LOGINS = 5;
export const DEFAULT_LOCKOUT_MINUTES = 15;

export function hasLockout(role: Role): boolean {
  return role !== "PASSENGER";
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** Con `failedAttempts` intentos fallidos seguidos (ya contando el último), ¿se bloquea? */
export function shouldLock(failedAttempts: number, maxFailedLogins: number): boolean {
  return failedAttempts >= maxFailedLogins;
}

export function lockedUntilFrom(now: Date, lockoutMinutes: number): Date {
  return new Date(now.getTime() + lockoutMinutes * 60_000);
}

/** Minutos que faltan para desbloquear, redondeados hacia arriba (mínimo 1). */
export function minutesUntilUnlock(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
