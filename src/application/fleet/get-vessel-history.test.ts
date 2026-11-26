import { describe, expect, it, vi } from "vitest";
import { VesselNotFoundError } from "./change-vessel-status";
import { createGetVesselHistory } from "./get-vessel-history";
import type { VesselStatusRepository } from "./ports";

describe("createGetVesselHistory", () => {
  it("devuelve historial de estados y viajes de la embarcación", async () => {
    const repo: VesselStatusRepository = {
      findVesselById: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        code: "L-01",
        name: "Lancha Coatzacoalcos I",
        status: "ACTIVE",
      }),
      changeStatusWithHistory: vi.fn(),
      getStatusHistory: vi.fn().mockResolvedValue([
        {
          id: "hist-1",
          vesselId: "11111111-1111-4111-8111-111111111111",
          fromStatus: "MAINTENANCE",
          toStatus: "ACTIVE",
          reason: "Reparación concluida",
          changedById: "33333333-3333-4333-8333-333333333333",
          changedByName: "Admin Muelle",
          changedAt: new Date("2026-11-21T18:00:00.000Z"),
        },
      ]),
      getTripsByVesselId: vi.fn().mockResolvedValue([
        {
          id: "trip-1",
          originDockName: "Coatzacoalcos",
          destinationDockName: "Villa Allende",
          status: "FINISHED",
          departedAt: new Date("2026-11-21T15:00:00.000Z"),
          arrivedAt: new Date("2026-11-21T15:15:00.000Z"),
          createdAt: new Date("2026-11-21T14:55:00.000Z"),
        },
      ]),
    };

    const getHistory = createGetVesselHistory(repo);
    const result = await getHistory("11111111-1111-4111-8111-111111111111");

    expect(result.statusHistory).toHaveLength(1);
    expect(result.trips).toHaveLength(1);
  });

  it("lanza VesselNotFoundError si no existe la embarcación", async () => {
    const repo: VesselStatusRepository = {
      findVesselById: vi.fn().mockResolvedValue(null),
      changeStatusWithHistory: vi.fn(),
      getStatusHistory: vi.fn(),
    };

    const getHistory = createGetVesselHistory(repo);
    await expect(getHistory("44444444-4444-4444-8444-444444444444")).rejects.toThrow(
      VesselNotFoundError,
    );
  });
});
