import { describe, expect, it, vi } from "vitest";

import type { FareRepository } from "@/application/fares/ports";
import { Money } from "@/domain/shared/money";

import { createSetFare } from "./set-fare";

describe("createSetFare", () => {
  const now = new Date("2026-11-22T18:00:00.000Z");
  const replaceCurrentFare = vi.fn(async (fare) => ({
    ...fare,
    id: "fare-id",
    vehicleTypeName: null,
  }));
  const fares: FareRepository = {
    replaceCurrentFare,
    listCurrentFares: vi.fn(),
    listFareHistory: vi.fn(),
    listVehicleTypes: vi.fn(),
  };
  const audit = { log: vi.fn(async () => {}) };

  it("uses the current time, saves the new price and records an audit event", async () => {
    const setFare = createSetFare({
      fares,
      audit,
      clock: { now: () => now },
    });

    await setFare(
      {
        vesselKind: "BOAT",
        category: "GENERAL",
        vehicleTypeId: null,
        amount: "8.50",
      },
      "admin-id",
    );

    expect(replaceCurrentFare).toHaveBeenCalledWith(
      expect.objectContaining({
        validFrom: now,
        validTo: null,
        amount: Money.fromPesos("8.50"),
        createdById: "admin-id",
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-id",
        action: "FARE_UPDATED",
        entityId: "fare-id",
      }),
    );
  });

  it("rejects malformed or mismatched input before calling the repository", async () => {
    const setFare = createSetFare({
      fares,
      audit,
      clock: { now: () => now },
    });
    replaceCurrentFare.mockClear();

    await expect(
      setFare(
        {
          vesselKind: "BOAT",
          category: "VEHICLE",
          vehicleTypeId: null,
          amount: "-1",
        },
        "admin-id",
      ),
    ).rejects.toMatchObject({ code: "INVALID_FARE" });
    expect(replaceCurrentFare).not.toHaveBeenCalled();
  });
});
