import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { createCreateVessel } from "./create-vessel";
import type { CreateVesselData, VesselDetail, VesselRepository } from "./vessel-ports";

function createFakeRepo(): VesselRepository {
  return {
    create: vi.fn(async (data: CreateVesselData): Promise<VesselDetail> => ({
      id: "vessel-1",
      code: data.code,
      name: data.name,
      kind: data.kind,
      registration: data.registration,
      color: data.color,
      photoUrl: data.photoUrl,
      passengerCapacity: data.passengerCapacity,
      status: "ACTIVE",
      createdAt: new Date("2026-11-21T20:00:00Z"),
      vehicleCapacities: data.vehicleCapacities.map((c) => ({
        vehicleTypeId: c.vehicleTypeId,
        vehicleTypeName: `Tipo ${c.vehicleTypeId}`,
        capacity: c.capacity,
      })),
    })),
    update: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    listVehicleTypes: vi.fn(),
  };
}

describe("createCreateVessel", () => {
  it("registra un transbordador con capacidades vehiculares", async () => {
    const repo = createFakeRepo();
    const createVessel = createCreateVessel(repo);

    const created = await createVessel({
      code: "t-01",
      name: "Transbordador Allende",
      kind: "FERRY",
      registration: "ver-501",
      color: "Blanco y azul",
      photoUrl: "",
      passengerCapacity: 150,
      vehicleCapacities: [{ vehicleTypeId: 1, capacity: 14 }],
    });

    expect(created.code).toBe("T-01");
    expect(created.registration).toBe("VER-501");
    expect(created.photoUrl).toBeNull();
    expect(created.vehicleCapacities).toHaveLength(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("falla con DomainError cuando los datos son invalidos", async () => {
    const repo = createFakeRepo();
    const createVessel = createCreateVessel(repo);

    await expect(
      createVessel({
        code: "L-01",
        name: "Lancha",
        kind: "BOAT",
        registration: "VER-100",
        passengerCapacity: 0,
      }),
    ).rejects.toThrow(DomainError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
