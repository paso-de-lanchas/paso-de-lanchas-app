import { describe, expect, it } from "vitest";

import { estimateArrival, estimateDeparture, formatUtcTime } from "./eta";

describe("passenger-info ETA domain rules", () => {
  const now = new Date("2026-11-23T12:10:00.000Z");

  it("calcula el tiempo estimado de salida según el ritmo de abordaje", () => {
    // 10 pasajeros abordaron en 5 minutos -> ritmo = 2 pasajeros/min; faltan 10 -> 5 min
    const startedAt = new Date("2026-11-23T12:05:00.000Z");
    const eta = estimateDeparture(20, 10, startedAt, now);

    expect(eta.minutesRemaining).toBe(5);
    expect(eta.estimatedAt).toEqual(new Date("2026-11-23T12:15:00.000Z"));
    expect(eta.label).toBe("5 min");
  });

  it("devuelve 'Calculando…' cuando aún no hay abordados o tiempo transcurrido", () => {
    expect(estimateDeparture(20, 0, new Date("2026-11-23T12:05:00.000Z"), now)).toEqual({
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    });

    expect(estimateDeparture(20, 4, null, now)).toEqual({
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    });

    expect(estimateDeparture(20, 4, now, now)).toEqual({
      minutesRemaining: null,
      estimatedAt: null,
      label: "Calculando…",
    });
  });

  it("devuelve 'Por salir' cuando la embarcación ya alcanzó su capacidad", () => {
    const startedAt = new Date("2026-11-23T12:00:00.000Z");
    const eta = estimateDeparture(20, 20, startedAt, now);

    expect(eta.minutesRemaining).toBe(0);
    expect(eta.label).toBe("Por salir");
  });

  it("calcula el tiempo estimado de llegada en tránsito con crossing_minutes", () => {
    // Zarpó hace 4 minutos y el cruce dura 10 minutos -> faltan 6 min
    const departedAt = new Date("2026-11-23T12:06:00.000Z");
    const eta = estimateArrival(departedAt, 10, now);

    expect(eta.minutesRemaining).toBe(6);
    expect(eta.estimatedAt).toEqual(new Date("2026-11-23T12:16:00.000Z"));
    expect(eta.label).toBe("6 min");

    // Si ya pasó el tiempo estimado de cruce -> "Por llegar"
    const overdue = estimateArrival(new Date("2026-11-23T11:55:00.000Z"), 10, now);
    expect(overdue.minutesRemaining).toBe(0);
    expect(overdue.label).toBe("Por llegar");

    // Sin hora de zarpe -> "Calculando…"
    expect(estimateArrival(null, 10, now).label).toBe("Calculando…");
  });

  it("formatea horas UTC de service_hours sin desfase de zona horaria", () => {
    expect(formatUtcTime(new Date("1970-01-01T06:00:00.000Z"))).toBe("06:00");
    expect(formatUtcTime(new Date("1970-01-01T22:30:00.000Z"))).toBe("22:30");
  });
});
