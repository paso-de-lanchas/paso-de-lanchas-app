import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { InvalidVesselStatusTransitionError } from "@/domain/fleet/vessel-status";
import { createChangeVesselStatus, VesselNotFoundError } from "./change-vessel-status";
import type { VesselStatusRepository } from "./ports";

function createMockRepository(overrides?: Partial<VesselStatusRepository>): VesselStatusRepository {
  return {
    findVesselById: vi.fn().mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      code: "L-01",
      name: "Lancha Coatzacoalcos I",
      status: "ACTIVE",
    }),
    changeStatusWithHistory: vi.fn().mockImplementation(async (params) => ({
      id: "22222222-2222-4222-8222-222222222222",
      vesselId: params.vesselId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      reason: params.reason,
      changedById: params.changedById,
      changedByName: "Admin Muelle",
      changedAt: new Date("2026-11-21T18:00:00.000Z"),
    })),
    getStatusHistory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("createChangeVesselStatus", () => {
  it("cambia el estado y registra el historial con motivo y usuario", async () => {
    const repo = createMockRepository();
    const changeStatus = createChangeVesselStatus(repo);

    const entry = await changeStatus({
      vesselId: "11111111-1111-4111-8111-111111111111",
      toStatus: "MAINTENANCE",
      reason: "Cambio de aceite y revisión de propela",
      changedById: "33333333-3333-4333-8333-333333333333",
    });

    expect(entry.fromStatus).toBe("ACTIVE");
    expect(entry.toStatus).toBe("MAINTENANCE");
    expect(entry.reason).toBe("Cambio de aceite y revisión de propela");
    expect(repo.changeStatusWithHistory).toHaveBeenCalledTimes(1);
  });

  it("rechaza cuando el motivo está vacío", async () => {
    const repo = createMockRepository();
    const changeStatus = createChangeVesselStatus(repo);

    await expect(
      changeStatus({
        vesselId: "11111111-1111-4111-8111-111111111111",
        toStatus: "MAINTENANCE",
        reason: "   ",
        changedById: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow(DomainError);

    expect(repo.changeStatusWithHistory).not.toHaveBeenCalled();
  });

  it("rechaza cuando la embarcación no existe", async () => {
    const repo = createMockRepository({
      findVesselById: vi.fn().mockResolvedValue(null),
    });
    const changeStatus = createChangeVesselStatus(repo);

    await expect(
      changeStatus({
        vesselId: "44444444-4444-4444-8444-444444444444",
        toStatus: "MAINTENANCE",
        reason: "Revisión",
        changedById: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow(VesselNotFoundError);
  });

  it("rechaza transiciones inválidas según el patrón State", async () => {
    const repo = createMockRepository({
      findVesselById: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        code: "L-01",
        name: "Lancha Coatzacoalcos I",
        status: "SEIZED",
      }),
    });
    const changeStatus = createChangeVesselStatus(repo);

    await expect(
      changeStatus({
        vesselId: "11111111-1111-4111-8111-111111111111",
        toStatus: "MAINTENANCE",
        reason: "Intento no válido",
        changedById: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow(InvalidVesselStatusTransitionError);

    expect(repo.changeStatusWithHistory).not.toHaveBeenCalled();
  });

  it("rechaza el cambio cuando otro administrador modificó el estado", async () => {
    const conflictError = new DomainError(
      "VESSEL_STATUS_CONFLICT",
      "El estado de la embarcación cambió. Recarga la información e inténtalo nuevamente.",
    );

    const repo = createMockRepository({
      changeStatusWithHistory: vi.fn().mockRejectedValue(conflictError),
    });

    const changeStatus = createChangeVesselStatus(repo);

    await expect(
      changeStatus({
        vesselId: "11111111-1111-4111-8111-111111111111",
        toStatus: "MAINTENANCE",
        reason: "Revisión de propela",
        changedById: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow(conflictError);

    expect(repo.changeStatusWithHistory).toHaveBeenCalledTimes(1);
  });
});
