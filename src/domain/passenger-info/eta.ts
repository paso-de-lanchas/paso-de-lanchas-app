export interface EtaEstimate {
  minutesRemaining: number | null;
  estimatedAt: Date | null;
  label: string;
}

export function formatMinutesLabel(minutes: number): string {
  if (minutes <= 0) {
    return "Por salir";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

/**
 * Estima la salida de una embarcación en abordaje según el ritmo real de pasajeros:
 * ritmo = abordados / minutos abordando. Si aún no hay ritmo medible, devuelve "Calculando…".
 */
export function estimateDeparture(
  capacity: number,
  occupied: number,
  boardingStartedAt: Date | null,
  now: Date,
): EtaEstimate {
  if (capacity > 0 && occupied >= capacity) {
    return {
      minutesRemaining: 0,
      estimatedAt: now,
      label: "Por salir",
    };
  }

  if (!boardingStartedAt || occupied <= 0 || capacity <= 0) {
    return {
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    };
  }

  const elapsedMinutes = (now.getTime() - boardingStartedAt.getTime()) / 60_000;
  if (elapsedMinutes <= 0) {
    return {
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    };
  }

  const boardingRatePerMinute = occupied / elapsedMinutes;
  const remainingSeats = capacity - occupied;
  const minutesRemaining = Math.max(1, Math.ceil(remainingSeats / boardingRatePerMinute));
  const estimatedAt = new Date(now.getTime() + minutesRemaining * 60_000);

  return {
    minutesRemaining,
    estimatedAt,
    label: formatMinutesLabel(minutesRemaining),
  };
}

/**
 * Estima la llegada de una embarcación en tránsito a partir de su hora de zarpe
 * y la duración típica del cruce (`crossing_minutes`).
 */
export function estimateArrival(
  departedAt: Date | null,
  crossingMinutes: number,
  now: Date,
): EtaEstimate {
  if (!departedAt || crossingMinutes <= 0) {
    return {
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    };
  }

  const estimatedAt = new Date(departedAt.getTime() + crossingMinutes * 60_000);
  const remainingMs = estimatedAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return {
      minutesRemaining: 0,
      estimatedAt,
      label: "Por llegar",
    };
  }

  const minutesRemaining = Math.max(1, Math.ceil(remainingMs / 60_000));
  return {
    minutesRemaining,
    estimatedAt,
    label: formatMinutesLabel(minutesRemaining),
  };
}

/** Formatea una hora almacenada como TIME(0) en UTC (ej. 1970-01-01T06:00:00Z -> "06:00"). */
export function formatUtcTime(time: Date): string {
  const hours = String(time.getUTCHours()).padStart(2, "0");
  const minutes = String(time.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
