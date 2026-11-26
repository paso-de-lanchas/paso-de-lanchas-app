import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { validateVesselRules } from "./vessel";

describe("validateVesselRules", () => {
  it("valida una lancha correcta y normaliza codigo y matricula", () => {
    const result = validateVesselRules({
      code: " l-01 ",
      name: " Lancha Coatzacoalcos I ",
      kind: "BOAT",
      registration: " ver-1234 ",
      passengerCapacity: 25,
    });

    expect(result).toEqual({
      code: "L-01",
      name: "Lancha Coatzacoalcos I",
      kind: "BOAT",
      registration: "VER-1234",
      passengerCapacity: 25,
      vehicleCapacities: [],
    });
  });

  it("valida un transbordador con capacidades vehiculares >= 0", () => {
    const result = validateVesselRules({
      code: "t-01",
      name: "Transbordador Grijalva",
      kind: "FERRY",
      registration: "ver-9999",
      passengerCapacity: 120,
      vehicleCapacities: [
        { vehicleTypeId: 1, capacity: 12 },
        { vehicleTypeId: 2, capacity: 0 },
      ],
    });

    expect(result.vehicleCapacities).toEqual([
      { vehicleTypeId: 1, capacity: 12 },
      { vehicleTypeId: 2, capacity: 0 },
    ]);
  });

  it("rechaza capacidad de pasajeros <= 0 o decimal", () => {
    expect(() =>
      validateVesselRules({
        code: "L-02",
        name: "Lancha II",
        kind: "BOAT",
        registration: "VER-2222",
        passengerCapacity: 0,
      }),
    ).toThrow(DomainError);

    expect(() =>
      validateVesselRules({
        code: "L-02",
        name: "Lancha II",
        kind: "BOAT",
        registration: "VER-2222",
        passengerCapacity: -5,
      }),
    ).toThrow(DomainError);
  });

  it("rechaza codigo, nombre o matricula vacios", () => {
    expect(() =>
      validateVesselRules({
        code: "  ",
        name: "Lancha",
        kind: "BOAT",
        registration: "VER-1",
        passengerCapacity: 10,
      }),
    ).toThrow(DomainError);

    expect(() =>
      validateVesselRules({
        code: "L-1",
        name: "  ",
        kind: "BOAT",
        registration: "VER-1",
        passengerCapacity: 10,
      }),
    ).toThrow(DomainError);

    expect(() =>
      validateVesselRules({
        code: "L-1",
        name: "Lancha",
        kind: "BOAT",
        registration: "  ",
        passengerCapacity: 10,
      }),
    ).toThrow(DomainError);
  });

  it("rechaza capacidad vehicular negativa, duplicada o asignada a lancha", () => {
    expect(() =>
      validateVesselRules({
        code: "T-01",
        name: "Ferry",
        kind: "FERRY",
        registration: "VER-10",
        passengerCapacity: 80,
        vehicleCapacities: [{ vehicleTypeId: 1, capacity: -1 }],
      }),
    ).toThrow(DomainError);

    expect(() =>
      validateVesselRules({
        code: "T-01",
        name: "Ferry",
        kind: "FERRY",
        registration: "VER-10",
        passengerCapacity: 80,
        vehicleCapacities: [
          { vehicleTypeId: 1, capacity: 5 },
          { vehicleTypeId: 1, capacity: 8 },
        ],
      }),
    ).toThrow(DomainError);

    expect(() =>
      validateVesselRules({
        code: "L-01",
        name: "Lancha",
        kind: "BOAT",
        registration: "VER-11",
        passengerCapacity: 20,
        vehicleCapacities: [{ vehicleTypeId: 1, capacity: 2 }],
      }),
    ).toThrow(DomainError);
  });
});
