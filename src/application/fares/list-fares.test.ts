import { describe, expect, it, vi } from "vitest";

import type { FareRepository } from "@/application/fares/ports";
import { Money } from "@/domain/shared/money";

import { createListCurrentFares } from "./list-current-fares";
import { createListFareHistory } from "./list-fare-history";

describe("fare listing use cases", () => {
  it("requests current fares at the supplied time and returns the complete history", async () => {
    const now = new Date("2026-11-22T18:00:00.000Z");
    const fares = [
      {
        id: "fare-id",
        vesselKind: "BOAT" as const,
        category: "GENERAL" as const,
        vehicleTypeId: null,
        vehicleTypeName: null,
        amount: Money.fromPesos("8.50"),
        validFrom: now,
        validTo: null,
        createdById: "admin-id",
      },
    ];
    const repository: FareRepository = {
      replaceCurrentFare: vi.fn(),
      listCurrentFares: vi.fn(async () => fares),
      listFareHistory: vi.fn(async () => fares),
      listVehicleTypes: vi.fn(),
    };

    await expect(createListCurrentFares(repository)(now)).resolves.toBe(fares);
    await expect(createListFareHistory(repository)()).resolves.toBe(fares);
    expect(repository.listCurrentFares).toHaveBeenCalledWith(now);
    expect(repository.listFareHistory).toHaveBeenCalledOnce();
  });
});
