import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { createFareStrategy } from "./fare-strategy-factory";
import type { VesselKind } from "./fare";
import type { FareOption } from "./fare-strategy";

const at = new Date("2026-11-22T18:00:00.000Z");

function fare(overrides: Partial<FareOption> = {}): FareOption {
  return {
    id: "fare-id",
    vesselKind: "BOAT",
    category: "GENERAL",
    vehicleTypeId: null,
    amount: Money.fromPesos("10.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
    ...overrides,
  };
}

describe("createFareStrategy", () => {
  it("uses only the boat fare active at the boarding time", () => {
    const expired = fare({
      id: "expired",
      amount: Money.fromPesos("5.00"),
      validTo: new Date("2026-11-22T18:00:00.000Z"),
    });
    const upcoming = fare({
      id: "upcoming",
      amount: Money.fromPesos("20.00"),
      validFrom: new Date("2026-11-22T18:00:00.001Z"),
    });
    const current = fare({ id: "current", amount: Money.fromPesos("12.00") });

    const result = createFareStrategy("BOAT").resolve({}, [expired, upcoming, current], at);

    expect(result).toMatchObject({
      fareId: "current",
      vesselKind: "BOAT",
      category: "GENERAL",
      amount: Money.fromPesos("12.00"),
    });
  });

  it.each([
    ["STUDENT", new Date("2026-11-22T23:59:59.000Z")],
    ["INAPAM", new Date("2026-11-22T23:59:59.000Z")],
  ] as const)(
    "applies an approved %s discount through its valid-until date",
    (type, validUntil) => {
      const student = fare({
        id: "student",
        category: type,
        amount: Money.fromPesos("5.00"),
      });

      const result = createFareStrategy("BOAT").resolve(
        { discount: { type, status: "APPROVED", validUntil } },
        [student],
        new Date("2026-11-23T05:30:00.000Z"),
      );

      expect(result).toMatchObject({ fareId: "student", category: type });
    },
  );

  it("falls back to the general boat fare for unapproved or expired discounts", () => {
    const general = fare({ id: "general" });
    const student = fare({ id: "student", category: "STUDENT" });
    const fares = [general, student];
    const strategy = createFareStrategy("BOAT");

    expect(
      strategy.resolve(
        { discount: { type: "STUDENT", status: "PENDING", validUntil: null } },
        fares,
        at,
      ).fareId,
    ).toBe("general");
    expect(
      strategy.resolve(
        {
          discount: {
            type: "STUDENT",
            status: "APPROVED",
            validUntil: new Date("2026-11-21T00:00:00.000Z"),
          },
        },
        fares,
        at,
      ).fareId,
    ).toBe("general");
    expect(
      strategy.resolve(
        {
          discount: {
            type: "STUDENT",
            status: "APPROVED",
            validUntil: new Date(Number.NaN),
          },
        },
        fares,
        at,
      ).fareId,
    ).toBe("general");
    // Un descuento aprobado siempre trae fecha de vencimiento (RF-020); sin ella no se aplica.
    expect(
      strategy.resolve(
        { discount: { type: "STUDENT", status: "APPROVED", validUntil: null } },
        fares,
        at,
      ).fareId,
    ).toBe("general");
  });

  it("deja de aplicar el descuento justo al terminar su último día en hora de México", () => {
    const general = fare({ id: "general" });
    const student = fare({ id: "student", category: "STUDENT" });
    const discount = {
      type: "STUDENT" as const,
      status: "APPROVED" as const,
      validUntil: new Date("2026-11-22T00:00:00.000Z"),
    };
    const strategy = createFareStrategy("BOAT");
    // 22 nov 23:59 en México = 23 nov 05:59 UTC: todavía vigente.
    expect(
      strategy.resolve({ discount }, [general, student], new Date("2026-11-23T05:59:00.000Z"))
        .fareId,
    ).toBe("student");
    // 23 nov 00:00 en México = 23 nov 06:00 UTC: ya venció.
    expect(
      strategy.resolve({ discount }, [general, student], new Date("2026-11-23T06:00:00.000Z"))
        .fareId,
    ).toBe("general");
  });

  it("uses the ferry fare for the exact vehicle type or the pedestrian fare", () => {
    const car = fare({
      id: "car",
      vesselKind: "FERRY",
      category: "VEHICLE",
      vehicleTypeId: 1,
      amount: Money.fromPesos("15.00"),
    });
    const motorcycle = fare({
      id: "motorcycle",
      vesselKind: "FERRY",
      category: "VEHICLE",
      vehicleTypeId: 2,
      amount: Money.fromPesos("5.00"),
    });
    const pedestrian = fare({
      id: "pedestrian",
      vesselKind: "FERRY",
      category: "PEDESTRIAN",
      amount: Money.fromPesos("1.00"),
    });
    const strategy = createFareStrategy("FERRY");

    expect(strategy.resolve({ vehicleTypeId: 1 }, [car, motorcycle], at).fareId).toBe("car");
    expect(strategy.resolve({}, [pedestrian], at).fareId).toBe("pedestrian");
  });

  it("throws a clear domain error when a fare is missing or the vehicle type is invalid", () => {
    expect(() => createFareStrategy("BOAT").resolve({}, [], at)).toThrowError(
      expect.objectContaining({ code: "FARE_NOT_CONFIGURED" }),
    );
    expect(() => createFareStrategy("FERRY").resolve({ vehicleTypeId: 0 }, [], at)).toThrowError(
      expect.objectContaining({ code: "INVALID_VEHICLE_TYPE" }),
    );
    expect(() => createFareStrategy("FERRY").resolve({ vehicleTypeId: 3 }, [], at)).toThrow(
      DomainError,
    );
  });

  it("rejects an unsupported vessel kind", () => {
    expect(() => createFareStrategy("CROSSING" as VesselKind)).toThrowError(
      expect.objectContaining({ code: "INVALID_VESSEL_KIND" }),
    );
  });
});
