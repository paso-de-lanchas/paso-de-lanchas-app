import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { createFare } from "./fare";

const validFare = {
  vesselKind: "BOAT" as const,
  category: "GENERAL" as const,
  vehicleTypeId: null,
  amount: Money.fromPesos("7.00"),
  validFrom: new Date("2026-11-22T12:00:00.000Z"),
  validTo: null,
  createdById: "admin-id",
};

describe("createFare", () => {
  it("accepts passenger and ferry fares with their required categories", () => {
    expect(createFare(validFare)).toEqual(validFare);
    expect(
      createFare({
        ...validFare,
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: 1,
      }),
    ).toMatchObject({ vesselKind: "FERRY", category: "VEHICLE", vehicleTypeId: 1 });
  });

  it("rejects negative values and categories for the wrong vessel", () => {
    expect(() => createFare({ ...validFare, amount: Money.fromPesos("-0.01") })).toThrow(
      DomainError,
    );
    expect(() => createFare({ ...validFare, vesselKind: "BOAT", category: "PEDESTRIAN" })).toThrow(
      DomainError,
    );
  });

  it("requires a vehicle type only for vehicle fares", () => {
    expect(() => createFare({ ...validFare, vesselKind: "FERRY", category: "VEHICLE" })).toThrow(
      DomainError,
    );
    expect(() => createFare({ ...validFare, vehicleTypeId: 1 })).toThrow(DomainError);
  });

  it("rejects amounts outside the database numeric range", () => {
    expect(() => createFare({ ...validFare, amount: Money.fromPesos("100000000.00") })).toThrow(
      DomainError,
    );
  });
});
