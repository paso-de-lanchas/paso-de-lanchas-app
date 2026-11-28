import { describe, expect, it } from "vitest";

import {
  ageLabel,
  distanceMeters,
  estimateArrivalFromPosition,
  isStale,
  isValidPoint,
} from "./live-position";

const COA = { latitude: 18.1497, longitude: -94.4349 };
const VAL = { latitude: 18.1435, longitude: -94.4443 };
const NOW = new Date("2026-11-27T18:00:00.000Z");
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

describe("distancia entre puntos", () => {
  it("entre los dos muelles son unos 1.2 km", () => {
    const meters = distanceMeters(COA, VAL);
    expect(meters).toBeGreaterThan(1100);
    expect(meters).toBeLessThan(1300);
  });

  it("es cero en el mismo punto y simétrica", () => {
    expect(distanceMeters(COA, COA)).toBe(0);
    expect(distanceMeters(COA, VAL)).toBeCloseTo(distanceMeters(VAL, COA), 6);
  });
});

describe("ubicación vieja (RF-080)", () => {
  it("después de 60 s ya no es en vivo", () => {
    expect(isStale(secondsAgo(60), NOW)).toBe(false);
    expect(isStale(secondsAgo(61), NOW)).toBe(true);
  });

  it("dice hace cuánto llegó la última ubicación", () => {
    expect(ageLabel(secondsAgo(45), NOW)).toBe("hace 45 s");
    expect(ageLabel(secondsAgo(180), NOW)).toBe("hace 3 min");
    expect(ageLabel(secondsAgo(3 * 3600 + 600), NOW)).toBe("hace 3 h 10 min");
    // Un reloj adelantado no da tiempos negativos.
    expect(ageLabel(new Date(NOW.getTime() + 5000), NOW)).toBe("hace 0 s");
  });
});

describe("tiempo estimado de llegada (RF-079)", () => {
  const base = { destination: VAL, crossingMinutes: 15, now: NOW };

  it("con ubicación reciente y en movimiento usa la distancia que falta", () => {
    // A unos 1.21 km del destino a 15 km/h → 4.8 min, que se redondea hacia arriba: 5 min.
    const eta = estimateArrivalFromPosition({
      ...base,
      position: { ...COA, speedKmh: 15, recordedAt: secondsAgo(5) },
      departedAt: secondsAgo(60),
    });
    expect(eta).toEqual({ minutes: 5, label: "5 min", basis: "DISTANCE" });
  });

  it("si la ubicación es vieja o está detenida, usa la duración típica del cruce", () => {
    const stale = estimateArrivalFromPosition({
      ...base,
      position: { ...COA, speedKmh: 12, recordedAt: secondsAgo(300) },
      departedAt: secondsAgo(10 * 60),
    });
    expect(stale).toEqual({ minutes: 5, label: "5 min", basis: "SCHEDULE" });

    const stopped = estimateArrivalFromPosition({
      ...base,
      position: { ...COA, speedKmh: 0.5, recordedAt: secondsAgo(5) },
      departedAt: secondsAgo(14 * 60),
    });
    expect(stopped).toEqual({ minutes: 1, label: "1 min", basis: "SCHEDULE" });
  });

  it("si ya pasó el tiempo del cruce dice 'Por llegar'", () => {
    const late = estimateArrivalFromPosition({
      ...base,
      position: null,
      departedAt: secondsAgo(20 * 60),
    });
    expect(late).toEqual({ minutes: 0, label: "Por llegar", basis: "SCHEDULE" });
  });

  it("sin ubicación ni hora de salida no inventa un dato", () => {
    expect(estimateArrivalFromPosition({ ...base, position: null, departedAt: null })).toEqual({
      minutes: null,
      label: "Calculando…",
      basis: "NONE",
    });
  });
});

describe("coordenadas válidas", () => {
  it("acepta los muelles y rechaza basura", () => {
    expect(isValidPoint(COA)).toBe(true);
    expect(isValidPoint({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidPoint({ latitude: 0, longitude: -181 })).toBe(false);
    expect(isValidPoint({ latitude: Number.NaN, longitude: 0 })).toBe(false);
  });
});
