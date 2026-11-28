/**
 * Reglas de dominio para avisos del muelle a pasajeros (RF-104 y RF-105)
 * y lectura coordinada de suspensiones de servicio (RF-103).
 */

export const MEXICO_TIMEZONE = "America/Mexico_City";

/** México (hora del centro) es UTC-6 permanente desde 2022. */
const MEXICO_UTC_OFFSET_HOURS = 6;

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface AnnouncementWindow {
  startsAt: Date;
  endsAt: Date | null;
}

export interface ServiceOverrideWindow {
  type: "EXTRA_SERVICE" | "SUSPENSION";
  startsAt: Date;
  endsAt: Date | null;
}

/** Determina si un aviso está vigente en el instante `now`. */
export function isAnnouncementActive(announcement: AnnouncementWindow, now: Date): boolean {
  if (announcement.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (announcement.endsAt !== null && announcement.endsAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Determina si una suspensión de servicio del muelle está activa en `now` (RF-103). */
export function isSuspensionActive(override: ServiceOverrideWindow, now: Date): boolean {
  if (override.type !== "SUSPENSION") {
    return false;
  }
  if (override.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (override.endsAt !== null && override.endsAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/**
 * Convierte una fecha/hora de formulario (`YYYY-MM-DDTHH:mm` en hora de México)
 * o una cadena ISO con zona horaria a un instante `Date` UTC válido.
 */
export function parseMexicoDateTimeInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const localMatch = LOCAL_DATETIME_PATTERN.exec(trimmed);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const second = Number(localMatch[6] ?? "0");

    const candidate = new Date(
      Date.UTC(year, month - 1, day, hour + MEXICO_UTC_OFFSET_HOURS, minute, second),
    );

    // Verifica que la fecha exista en el calendario (evita 2026-02-31 -> marzo)
    const verifyLocal = new Date(candidate.getTime() - MEXICO_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    if (
      verifyLocal.getUTCFullYear() !== year ||
      verifyLocal.getUTCMonth() !== month - 1 ||
      verifyLocal.getUTCDate() !== day ||
      verifyLocal.getUTCHours() !== hour ||
      verifyLocal.getUTCMinutes() !== minute
    ) {
      return null;
    }

    return candidate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formatea un instante UTC en horario de México para mostrar en UI. */
export function formatAnnouncementDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MEXICO_TIMEZONE,
  }).format(date);
}
