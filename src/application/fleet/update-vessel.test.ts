import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { createUpdateVessel } from "./update-vessel";
import type { VesselDetail, VesselRepository } from "./vessel-ports";

const existingVessel: VesselDetail = {
  id: "vessel-1",
  code: "L-01",
  name: "Lancha I",
  kind: "BOAT",
  registration: "VER-101",
  color: "Blanco",
  photoUrl: null,
  passengerCapacity: 24,
  status: "ACTIVE",
  createdAt: new Date("2026-11-21T20:00:00Z"),
  vehicleCapacities: [],
};

describe("createUpdateVessel", () => {
  it("actualiza una embarcacion existente", async () => {
    const repo: VesselRepository = {
      create: vi.fn(),
      update: vi.fn(async (data) => ({
        ...existingVessel,
        ...data,
        vehicleCapacities: [],
      })),
      findById: vi.fn().mockResolvedValue(existingVessel),
      list: vi.fn(),
      listVehicleTypes: vi.fn(),
    };

    const updateVessel = createUpdateVessel(repo);
    const updated = await updateVessel("vessel-1", {
      code: "l-01",
      name: "Lancha I Renovada",
      kind: "BOAT",
      registration: "ver-101",
      color: "Azul",
      passengerCapacity: 28,
    });

    expect(updated.name).toBe("Lancha I Renovada");
    expect(updated.passengerCapacity).toBe(28);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("falla si la embarcacion no existe", async () => {
    const repo: VesselRepository = {
      create: vi.fn(),
      update: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      listVehicleTypes: vi.fn(),
    };

    const updateVessel = createUpdateVessel(repo);
    await expect(
      updateVessel("no-existe", {
        code: "L-01",
        name: "Lancha",
        kind: "BOAT",
        registration: "VER-101",
        passengerCapacity: 20,
      }),
    ).rejects.toThrow(DomainError);
  });
});
