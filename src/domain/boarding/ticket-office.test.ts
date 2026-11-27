import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { resolveTicketOfficeFare } from "./ticket-office";
import type { FareOption } from "@/domain/fares/fare-strategy";

const NOW = new Date("2026-11-27T18:00:00.000Z");
const fares: FareOption[] = [
  {
    id: "fare-general",
    vesselKind: "BOAT",
    category: "GENERAL",
    vehicleTypeId: null,
    amount: Money.fromPesos("10.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
  },
  {
    id: "fare-student",
    vesselKind: "BOAT",
    category: "STUDENT",
    vehicleTypeId: null,
    amount: Money.fromPesos("5.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
  },
  {
    id: "fare-car",
    vesselKind: "FERRY",
    category: "VEHICLE",
    vehicleTypeId: 1,
    amount: Money.fromPesos("15.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
  },
  {
    id: "fare-pedestrian",
    vesselKind: "FERRY",
    category: "PEDESTRIAN",
    vehicleTypeId: null,
    amount: Money.fromPesos("1.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
  },
];

describe("resolver tarifa de boleto en taquilla", () => {
  it("resuelve la categoría elegida y la tarifa vigente", () => {
    expect(resolveTicketOfficeFare("fare-student", "BOAT", fares, NOW)).toMatchObject({
      fareId: "fare-student",
      amount: Money.fromPesos("5.00"),
    });
  });

  it("rechaza una tarifa que no corresponde a la embarcación", () => {
    expect(() => resolveTicketOfficeFare("fare-car", "BOAT", fares, NOW)).toThrow(DomainError);
  });

  it("resuelve boleto de peatón y de vehículo en transbordador", () => {
    expect(resolveTicketOfficeFare("fare-pedestrian", "FERRY", fares, NOW).fareId).toBe(
      "fare-pedestrian",
    );
    expect(resolveTicketOfficeFare("fare-car", "FERRY", fares, NOW).fareId).toBe("fare-car");
  });

  it("no permite usar una tarifa vencida", () => {
    expect(() =>
      resolveTicketOfficeFare(
        "fare-general",
        "BOAT",
        fares.map((fare) =>
          fare.id === "fare-general" ? { ...fare, validTo: new Date(NOW.getTime()) } : fare,
        ),
        NOW,
      ),
    ).toThrow("La tarifa seleccionada ya no está vigente.");
  });
});
