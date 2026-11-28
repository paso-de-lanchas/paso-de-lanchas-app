/**
 * Reglas para CONSULTAR la bitácora (RF-124). La bitácora es inmutable en la base (RF-123):
 * aquí solo se decide qué se muestra y cómo se filtra.
 */

/** México (hora del centro) no tiene horario de verano desde 2022: siempre UTC-6. */
const MEXICO_UTC_OFFSET_HOURS = 6;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Inicio del día `YYYY-MM-DD` en hora de México, como instante UTC. Null si la fecha no existe. */
export function startOfMexicoDay(dateKey: string): Date | null {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day, MEXICO_UTC_OFFSET_HOURS));
  // Rechaza fechas imposibles como 2026-02-31 (Date las "corrige" al mes siguiente).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Rango de fechas del filtro, de día completo en hora de México: `desde` incluye todo su día y
 * `hasta` también (el límite es el inicio del día siguiente, exclusivo).
 */
export function mexicoDateRange(
  from: string | undefined,
  to: string | undefined,
): { from?: Date; toExclusive?: Date } {
  const start = from ? startOfMexicoDay(from) : null;
  const endDay = to ? startOfMexicoDay(to) : null;
  const toExclusive = endDay ? new Date(endDay.getTime() + 24 * 60 * 60 * 1000) : null;
  return {
    ...(start ? { from: start } : {}),
    ...(toExclusive ? { toExclusive } : {}),
  };
}

/** Llaves que nunca se muestran aunque alguien las haya guardado por error en el detalle. */
const SENSITIVE_KEY = /pass(word)?|token|secret|hash|totp|cookie|authorization|card|cvv/i;

const REDACTED = "[oculto]";
const MAX_DEPTH = 5;

/** Copia del detalle con los datos sensibles ocultos (en cualquier nivel). */
export function redactAuditDetails(details: unknown, depth = 0): unknown {
  if (details === null || typeof details !== "object") return details;
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(details)) return details.map((item) => redactAuditDetails(item, depth + 1));
  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redactAuditDetails(value, depth + 1),
    ]),
  );
}

/** Nombres en español de las acciones que hoy registra el sistema (RF-122). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCEEDED: "Inicio de sesión",
  LOGIN_FAILED: "Inicio de sesión fallido",
  LOGIN_REJECTED_LOCKED: "Inicio rechazado: cuenta bloqueada",
  LOGIN_REJECTED_DEVICE: "Inicio rechazado: computadora no autorizada",
  LOGOUT: "Cierre de sesión",
  SESSION_EXPIRED_IDLE: "Sesión cerrada por inactividad",
  USER_REGISTERED: "Registro de pasajero",
  EMAIL_VERIFIED: "Correo confirmado",
  PASSWORD_RESET_REQUESTED: "Pidió recuperar contraseña",
  PASSWORD_RESET: "Contraseña restablecida",
  PASSWORD_CHANGED: "Contraseña cambiada",
  PASSWORD_CHANGE_FAILED: "Cambio de contraseña fallido",
  ACCOUNT_CANCELLED: "Cuenta cancelada",
  STAFF_ACCOUNT_CREATED: "Cuenta de personal creada",
  STAFF_ACCOUNT_DEACTIVATED: "Cuenta de personal desactivada",
  STAFF_ACCOUNT_REACTIVATED: "Cuenta de personal reactivada",
  STAFF_ACCOUNT_UNLOCKED: "Cuenta de personal desbloqueada",
  STAFF_PASSWORD_RESET: "Contraseña temporal del personal",
  STAFF_EMAIL_FAILED: "No se envió el correo al personal",
  DEVICE_APPROVAL_REQUESTED: "Solicitud de computadora",
  DEVICE_APPROVED: "Computadora aprobada",
  DEVICE_RENAMED: "Computadora renombrada",
  DEVICE_REVOKED: "Computadora revocada",
  WALLET_TOPUP_CASH: "Recarga en efectivo",
  WALLET_REFUND: "Reembolso al saldo",
  WALLET_ADJUSTED: "Ajuste de saldo",
  WALLET_FARE_CHARGE: "Cobro del cruce",
  BOARDING_QR: "Abordaje con QR",
  BOARDING_QR_REJECTED: "QR rechazado",
  FARE_UPDATED: "Tarifa cambiada",
  VESSEL_CREATED: "Embarcación registrada",
  VESSEL_UPDATED: "Embarcación editada",
  VESSEL_STATUS_CHANGED: "Estado de embarcación",
  DEPARTURE_ENQUEUED: "Embarcación formada en fila",
  DEPARTURE_BOARDING_STARTED: "Abordaje abierto",
  DEPARTURE_BOARDING_CLOSED: "Abordaje cerrado",
  DEPARTURE_QUEUE_REORDERED: "Fila reordenada",
  WAITLIST_ENTRY_ADDED: "Lista de espera",
  ANNOUNCEMENT_PUBLISHED: "Aviso publicado",
  ANNOUNCEMENT_CLOSED: "Aviso finalizado",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
