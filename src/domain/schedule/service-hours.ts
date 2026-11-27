export const SERVICE_TIMEZONE = "America/Mexico_City";

export type ServiceOverrideType = "SUSPENSION" | "EXTRA_SERVICE";

export interface ServiceHourWindow {
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  /** Minutos desde 00:00 (0..1439) o cadena HH:mm / HH:mm:ss */
  opensAt: string | Date;
  /** Minutos desde 00:00 (0..1440) o cadena HH:mm / HH:mm:ss */
  closesAt: string | Date;
}

export interface ServiceOverrideWindow {
  type: ServiceOverrideType;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface ServiceOpenResult {
  open: boolean;
  reasonCode: "REGULAR_HOURS" | "EXTRA_SERVICE" | "SUSPENDED" | "OUT_OF_SERVICE_HOURS";
  reason?: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getLocalClockParts(now: Date): {
  weekday: number;
  minutesOfDay: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SERVICE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";

  const weekday = WEEKDAY_MAP[weekdayStr] ?? 1;
  const hour = Number(hourStr) % 24;
  const minute = Number(minuteStr);

  return {
    weekday,
    minutesOfDay: hour * 60 + minute,
  };
}

function parseTimeToMinutes(value: string | Date): number {
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    return 0;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function isOverrideActive(override: ServiceOverrideWindow, now: Date): boolean {
  const nowMs = now.getTime();
  if (nowMs < override.startsAt.getTime()) {
    return false;
  }
  if (override.endsAt !== null && nowMs >= override.endsAt.getTime()) {
    return false;
  }
  return true;
}

/**
 * Evalúa si el servicio de un muelle está abierto en `now` (zona America/Mexico_City):
 * 1. Una suspensión activa (`SUSPENSION`) bloquea siempre el servicio.
 * 2. Un servicio extraordinario activo (`EXTRA_SERVICE`) habilita el servicio aunque sea fuera de horario[cite: 2].
 * 3. En otro caso, se valida la ventana del día de la semana en `service_hours`[cite: 2].
 */
export function evaluateServiceOpen(
  hours: readonly ServiceHourWindow[],
  overrides: readonly ServiceOverrideWindow[],
  now: Date,
): ServiceOpenResult {
  const activeOverrides = overrides.filter((o) => isOverrideActive(o, now));

  const suspension = activeOverrides.find((o) => o.type === "SUSPENSION");
  if (suspension) {
    return {
      open: false,
      reasonCode: "SUSPENDED",
      reason: suspension.reason,
    };
  }

  const extraService = activeOverrides.find((o) => o.type === "EXTRA_SERVICE");
  if (extraService) {
    return {
      open: true,
      reasonCode: "EXTRA_SERVICE",
      reason: extraService.reason,
    };
  }

  const { weekday, minutesOfDay } = getLocalClockParts(now);
  const daySchedule = hours.find((h) => h.weekday === weekday);
  if (!daySchedule) {
    return {
      open: false,
      reasonCode: "OUT_OF_SERVICE_HOURS",
      reason: "Sin horario de servicio configurado para este día.",
    };
  }

  const opensMinutes = parseTimeToMinutes(daySchedule.opensAt);
  const closesMinutes = parseTimeToMinutes(daySchedule.closesAt);

  if (minutesOfDay >= opensMinutes && minutesOfDay < closesMinutes) {
    return {
      open: true,
      reasonCode: "REGULAR_HOURS",
    };
  }

  return {
    open: false,
    reasonCode: "OUT_OF_SERVICE_HOURS",
    reason: "Fuera del horario de servicio del muelle.",
  };
}

export function isServiceOpen(
  hours: readonly ServiceHourWindow[],
  overrides: readonly ServiceOverrideWindow[],
  now: Date,
): boolean {
  return evaluateServiceOpen(hours, overrides, now).open;
}
