/**
 * Reglas del mapa en vivo (RF-077 a RF-081). Funciones puras: reciben la última ubicación
 * que mandó el celular del chofer (#49) y deciden qué mostrar.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia en metros entre dos puntos (fórmula de haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Una ubicación con más de este tiempo ya no se considera "en vivo" (RF-080). */
export const STALE_AFTER_SECONDS = 60;

/** Velocidad mínima para calcular la llegada por distancia; más lento es "detenido". */
const MIN_SPEED_KMH = 2;

export function isStale(recordedAt: Date, now: Date): boolean {
  return now.getTime() - recordedAt.getTime() > STALE_AFTER_SECONDS * 1000;
}

/** "hace 3 min", "hace 45 s"… para cuando no hay datos recientes (RF-080). */
export function ageLabel(recordedAt: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - recordedAt.getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h ${minutes % 60} min`;
}

export interface ArrivalEstimate {
  minutes: number | null;
  label: string;
  /** "DISTANCE" si se calculó con la ubicación y velocidad; "SCHEDULE" con la duración típica. */
  basis: "DISTANCE" | "SCHEDULE" | "NONE";
}

function minutesLabel(minutes: number): string {
  if (minutes <= 0) return "Por llegar";
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

/**
 * Tiempo estimado de llegada (RF-079). Si hay una ubicación reciente con velocidad, se usa la
 * distancia que falta al muelle; si no, la hora de salida más la duración típica del cruce.
 */
export function estimateArrivalFromPosition(input: {
  position: (GeoPoint & { speedKmh: number | null; recordedAt: Date }) | null;
  destination: GeoPoint;
  departedAt: Date | null;
  crossingMinutes: number;
  now: Date;
}): ArrivalEstimate {
  const { position, destination, departedAt, crossingMinutes, now } = input;

  if (position && !isStale(position.recordedAt, now) && (position.speedKmh ?? 0) >= MIN_SPEED_KMH) {
    const meters = distanceMeters(position, destination);
    const minutes = Math.ceil((meters / 1000 / position.speedKmh!) * 60);
    return { minutes, label: minutesLabel(minutes), basis: "DISTANCE" };
  }

  if (departedAt && crossingMinutes > 0) {
    const remainingMs = departedAt.getTime() + crossingMinutes * 60_000 - now.getTime();
    const minutes = Math.max(0, Math.ceil(remainingMs / 60_000));
    return { minutes, label: minutesLabel(minutes), basis: "SCHEDULE" };
  }

  return { minutes: null, label: "Calculando…", basis: "NONE" };
}

/** Coordenadas válidas en grados (descarta datos basura que mande un celular). */
export function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}
