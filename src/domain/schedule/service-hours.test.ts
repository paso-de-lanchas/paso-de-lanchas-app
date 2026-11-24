import { describe, expect, it } from "vitest";
import {
  evaluateServiceOpen,
  isServiceOpen,
  type ServiceHourWindow,
  type ServiceOverrideWindow,
} from "./service-hours";
import { evaluateBoardingTimeout, isBoardingOverdue } from "./boarding-timeout";

// Lunes 05:30 AM en America/Mexico_City (UTC-6 => 11:30 UTC)
const monday0530Local = new Date("2026-11-23T11:30:00.000Z");
// Lunes 08:00 AM en America/Mexico_City (UTC-6 => 14:00 UTC)
const monday0800Local = new Date("2026-11-23T14:00:00.000Z");
// Lunes 22:30 PM en America/Mexico_City (UTC-6 => Martes 04:30 UTC)
const monday2230Local = new Date("2026-11-24T04:30:00.000Z");
// Martes 06:15 AM en America/Mexico_City (UTC-6 => Martes 12:15 UTC)
const tuesday0615Local = new Date("2026-11-24T12:15:00.000Z");

const baseHours: ServiceHourWindow[] = [
  { weekday: 1, opensAt: "06:00:00", closesAt: "22:00:00" },
  {
    weekday: 2,
    opensAt: new Date("1970-01-01T06:00:00.000Z"),
    closesAt: new Date("1970-01-01T21:00:00.000Z"),
  },
];

describe("isServiceOpen (America/Mexico_City)", () => {
  it("rechaza antes de abrir y después de cerrar, y permite dentro de horario", () => {
    expect(isServiceOpen(baseHours, [], monday0530Local)).toBe(false);
    expect(isServiceOpen(baseHours, [], monday0800Local)).toBe(true);
    expect(isServiceOpen(baseHours, [], monday2230Local)).toBe(false);
  });

  it("maneja correctamente el cambio de día en zona America/Mexico_City", () => {
    // 22:30 local lunes ya es martes en UTC, pero sigue siendo lunes cerrado en México
    expect(evaluateServiceOpen(baseHours, [], monday2230Local)).toMatchObject({
      open: false,
      reasonCode: "OUT_OF_SERVICE_HOURS",
    });
    // Martes 06:15 local abre con horario de martes (weekday 2)
    expect(isServiceOpen(baseHours, [], tuesday0615Local)).toBe(true);
    // Domingo (weekday 0) sin horario configurado cierra
    const sunday1000Local = new Date("2026-11-22T16:00:00.000Z");
    expect(isServiceOpen(baseHours, [], sunday1000Local)).toBe(false);
  });

  it("habilita servicio fuera de horario cuando existe EXTRA_SERVICE vigente", () => {
    const extra: ServiceOverrideWindow = {
      type: "EXTRA_SERVICE",
      reason: "Cruce nocturno por evento municipal",
      startsAt: new Date("2026-11-24T03:00:00.000Z"),
      endsAt: new Date("2026-11-24T06:00:00.000Z"),
    };

    expect(evaluateServiceOpen(baseHours, [extra], monday2230Local)).toEqual({
      open: true,
      reasonCode: "EXTRA_SERVICE",
      reason: "Cruce nocturno por evento municipal",
    });
  });

  it("bloquea el servicio cuando existe una SUSPENSION activa (incluso sobre EXTRA_SERVICE)", () => {
    const extra: ServiceOverrideWindow = {
      type: "EXTRA_SERVICE",
      reason: "Servicio nocturno",
      startsAt: new Date("2026-11-23T00:00:00.000Z"),
      endsAt: null,
    };
    const suspension: ServiceOverrideWindow = {
      type: "SUSPENSION",
      reason: "Puerto cerrado por norte",
      startsAt: new Date("2026-11-23T12:00:00.000Z"),
      endsAt: new Date("2026-11-23T18:00:00.000Z"),
    };

    expect(evaluateServiceOpen(baseHours, [extra, suspension], monday0800Local)).toEqual({
      open: false,
      reasonCode: "SUSPENDED",
      reason: "Puerto cerrado por norte",
    });
  });
});

describe("isBoardingOverdue", () => {
  it("avisa únicamente cuando el tiempo abordando supera maxMinutes", () => {
    const startedAt = new Date("2026-11-23T14:00:00.000Z");
    const at20Min = new Date("2026-11-23T14:20:00.000Z");
    const at21Min = new Date("2026-11-23T14:21:00.000Z");

    expect(isBoardingOverdue(null, at21Min, 20)).toBe(false);
    expect(isBoardingOverdue(startedAt, at20Min, 20)).toBe(false);
    expect(evaluateBoardingTimeout(startedAt, at21Min, 20)).toEqual({
      overdue: true,
      elapsedMinutes: 21,
      maxMinutes: 20,
    });
  });
});
