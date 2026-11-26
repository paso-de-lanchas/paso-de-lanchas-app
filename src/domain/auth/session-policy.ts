import type { Role } from "./roles";

/**
 * Cuánto dura una sesión. El pasajero usa su celular personal y no debe iniciar sesión a
 * cada rato; el personal usa computadoras del muelle compartidas, así que su sesión es corta.
 * (La expiración por inactividad del personal llega con el issue #9.)
 */
export const PASSENGER_SESSION_DAYS = 30;
export const STAFF_SESSION_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;

export function sessionExpiresAt(role: Role, now: Date): Date {
  const duration =
    role === "PASSENGER" ? PASSENGER_SESSION_DAYS * 24 * HOUR_MS : STAFF_SESSION_HOURS * HOUR_MS;
  return new Date(now.getTime() + duration);
}

export function isSessionExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Expiración por inactividad (RF-012) para administrador y superadministrador: si no hacen
 * nada durante `session_timeout_minutes_staff`, la sesión se cierra.
 */
export const DEFAULT_STAFF_IDLE_MINUTES = 30;

/** Para no escribir en la base en cada petición, la actividad se registra a lo más una vez por minuto. */
export const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

export function hasIdleTimeout(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function isIdleExpired(lastActivityAt: Date, now: Date, idleMinutes: number): boolean {
  return now.getTime() - lastActivityAt.getTime() >= idleMinutes * 60_000;
}

export function shouldRecordActivity(lastActivityAt: Date, now: Date): boolean {
  return now.getTime() - lastActivityAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS;
}
