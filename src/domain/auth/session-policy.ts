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
