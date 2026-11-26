import { describe, expect, it } from "vitest";

import { InputError } from "@/application/shared/input-error";
import type { Clock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import { createAddVehicle } from "./add-vehicle";
import {
  createGetMyVehicle,
  createListActiveVehicleTypes,
  createListMyVehicles,
} from "./list-my-vehicles";
import type {
  ActiveVehicleType,
  CreateVehicleData,
  UpdateVehicleData,
  VehicleFareProvider,
  VehicleFaresMap,
  VehicleRecord,
  VehicleRepository,
} from "./ports";
import { createRemoveVehicle } from "./remove-vehicle";
import { createUpdateVehicle } from "./update-vehicle";

class InMemoryVehicleRepository implements VehicleRepository {
  types: ActiveVehicleType[] = [
    { id: 1, name: "Automóvil" },
    { id: 2, name: "Motocicleta" },
    { id: 3, name: "Camioneta" },
  ];
  inactiveTypeIds = new Set<number>([99]);
  records: VehicleRecord[] = [];
  private seq = 1;

  async findActiveTypes(): Promise<ActiveVehicleType[]> {
    return [...this.types];
  }

  async isActiveType(vehicleTypeId: number): Promise<boolean> {
    if (this.inactiveTypeIds.has(vehicleTypeId)) return false;
    return this.types.some((t) => t.id === vehicleTypeId);
  }

  async listByOwner(ownerId: string): Promise<VehicleRecord[]> {
    return this.records.filter((r) => r.ownerId === ownerId && r.deletedAt === null);
  }

  async findByIdAndOwner(vehicleId: string, ownerId: string): Promise<VehicleRecord | null> {
    return (
      this.records.find(
        (r) => r.id === vehicleId && r.ownerId === ownerId && r.deletedAt === null,
      ) ?? null
    );
  }

  async create(data: CreateVehicleData): Promise<VehicleRecord> {
    const duplicate = this.records.some(
      (r) => r.ownerId === data.ownerId && r.plate === data.plate,
    );
    if (duplicate) {
      throw new DomainError("DUPLICATE_PLATE", "Ya registraste un vehículo con esas placas.");
    }
    const type = this.types.find((t) => t.id === data.vehicleTypeId)!;
    const created: VehicleRecord = {
      id: `veh-${this.seq++}`,
      ownerId: data.ownerId,
      vehicleTypeId: data.vehicleTypeId,
      vehicleTypeName: type.name,
      brand: data.brand,
      model: data.model,
      color: data.color,
      plate: data.plate,
      photoUrl: data.photoUrl,
      deletedAt: null,
    };
    this.records.push(created);
    return created;
  }

  async update(
    vehicleId: string,
    ownerId: string,
    data: UpdateVehicleData,
  ): Promise<VehicleRecord | null> {
    const existing = this.records.find(
      (r) => r.id === vehicleId && r.ownerId === ownerId && r.deletedAt === null,
    );
    if (!existing) return null;

    const duplicate = this.records.some(
      (r) => r.ownerId === ownerId && r.plate === data.plate && r.id !== vehicleId,
    );
    if (duplicate) {
      throw new DomainError("DUPLICATE_PLATE", "Ya registraste un vehículo con esas placas.");
    }

    const type = this.types.find((t) => t.id === data.vehicleTypeId)!;
    existing.vehicleTypeId = data.vehicleTypeId;
    existing.vehicleTypeName = type.name;
    existing.brand = data.brand;
    existing.model = data.model;
    existing.color = data.color;
    existing.plate = data.plate;
    existing.photoUrl = data.photoUrl;
    return { ...existing };
  }

  async softDelete(vehicleId: string, ownerId: string, deletedAt: Date): Promise<boolean> {
    const existing = this.records.find(
      (r) => r.id === vehicleId && r.ownerId === ownerId && r.deletedAt === null,
    );
    if (!existing) return false;
    existing.deletedAt = deletedAt;
    return true;
  }
}

const staticFares: VehicleFareProvider = {
  async getCurrentVehicleFaresCents(): Promise<VehicleFaresMap> {
    return new Map([
      [1, 1500],
      [2, 500],
      [3, 2000],
    ]);
  },
};

describe("vehicles application use cases", () => {
  const fixedNow = new Date("2026-11-23T16:00:00.000Z");
  const fixedClock: Clock = { now: () => fixedNow };

  it("registra vehículo normalizando placas, rechaza duplicados y muestra errores por campo", async () => {
    const repo = new InMemoryVehicleRepository();
    const addVehicle = createAddVehicle({ vehicles: repo });

    const created = await addVehicle("user-1", {
      vehicleTypeId: "1",
      brand: "Nissan",
      model: "Versa",
      color: "Blanco",
      plate: "yxz-123-a",
      photoUrl: "https://ejemplo.test/versa.jpg",
    });

    expect(created.plate).toBe("YXZ123A");
    expect(created.vehicleTypeName).toBe("Automóvil");
    expect(created.photoUrl).toBe("https://ejemplo.test/versa.jpg");

    await expect(
      addVehicle("user-1", {
        vehicleTypeId: 1,
        brand: "Chevrolet",
        model: "Aveo",
        color: "Gris",
        plate: "YXZ 123 A",
        photoUrl: "",
      }),
    ).rejects.toMatchObject({
      fieldErrors: { plate: "Ya registraste un vehículo con esas placas." },
    });

    const otherUserVehicle = await addVehicle("user-2", {
      vehicleTypeId: 1,
      brand: "Chevrolet",
      model: "Aveo",
      color: "Gris",
      plate: "YXZ123A",
    });
    expect(otherUserVehicle.ownerId).toBe("user-2");

    await expect(
      addVehicle("user-1", {
        vehicleTypeId: 99,
        brand: "Ford",
        model: "Fiesta",
        color: "Azul",
        plate: "DEF5678",
      }),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("lista vehículos activos del pasajero con su tarifa vigente y oculta eliminados o de otros dueños", async () => {
    const repo = new InMemoryVehicleRepository();
    const addVehicle = createAddVehicle({ vehicles: repo });
    const removeVehicle = createRemoveVehicle({ vehicles: repo, clock: fixedClock });
    const listMyVehicles = createListMyVehicles({
      vehicles: repo,
      fares: staticFares,
      clock: fixedClock,
    });
    const listTypes = createListActiveVehicleTypes({ vehicles: repo });

    expect(await listTypes()).toHaveLength(3);

    const v1 = await addVehicle("user-1", {
      vehicleTypeId: 1,
      brand: "Nissan",
      model: "Versa",
      color: "Blanco",
      plate: "AAA1111",
    });
    const v2 = await addVehicle("user-1", {
      vehicleTypeId: 2,
      brand: "Honda",
      model: "Cargo",
      color: "Rojo",
      plate: "BBB2222",
    });
    await addVehicle("user-2", {
      vehicleTypeId: 3,
      brand: "Toyota",
      model: "Hilux",
      color: "Negro",
      plate: "CCC3333",
    });

    await removeVehicle("user-1", v2.id);
    expect(repo.records.find((r) => r.id === v2.id)?.deletedAt).toEqual(fixedNow);

    const myVehicles = await listMyVehicles("user-1");
    expect(myVehicles).toHaveLength(1);
    expect(myVehicles[0]?.id).toBe(v1.id);
    expect(myVehicles[0]?.fareCents).toBe(1500);
    expect(myVehicles[0]?.formattedFare).toContain("15.00");
  });

  it("edita y elimina solo vehículos propios, devolviendo 'No encontrado' si pertenece a otro usuario", async () => {
    const repo = new InMemoryVehicleRepository();
    const addVehicle = createAddVehicle({ vehicles: repo });
    const updateVehicle = createUpdateVehicle({ vehicles: repo });
    const removeVehicle = createRemoveVehicle({ vehicles: repo, clock: fixedClock });
    const getMyVehicle = createGetMyVehicle({
      vehicles: repo,
      fares: staticFares,
      clock: fixedClock,
    });

    const v1 = await addVehicle("user-1", {
      vehicleTypeId: 1,
      brand: "Nissan",
      model: "Versa",
      color: "Blanco",
      plate: "AAA1111",
    });

    await expect(getMyVehicle("user-2", v1.id)).rejects.toThrow("No encontrado");
    await expect(
      updateVehicle("user-2", v1.id, {
        vehicleTypeId: 1,
        brand: "Hack",
        model: "Hack",
        color: "Negro",
        plate: "AAA1111",
      }),
    ).rejects.toThrow("No encontrado");
    await expect(removeVehicle("user-2", v1.id)).rejects.toThrow("No encontrado");

    const updated = await updateVehicle("user-1", v1.id, {
      vehicleTypeId: 3,
      brand: "Nissan",
      model: "NP300",
      color: "Plata",
      plate: "zzz-9999",
      photoUrl: "https://ejemplo.test/np300.jpg",
    });
    expect(updated.plate).toBe("ZZZ9999");
    expect(updated.vehicleTypeName).toBe("Camioneta");

    const fetched = await getMyVehicle("user-1", v1.id);
    expect(fetched.fareCents).toBe(2000);
  });
});
