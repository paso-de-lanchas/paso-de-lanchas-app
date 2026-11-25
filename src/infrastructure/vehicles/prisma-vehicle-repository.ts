import type {
  ActiveVehicleType,
  CreateVehicleData,
  UpdateVehicleData,
  VehicleRecord,
  VehicleRepository,
} from "@/application/vehicles/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { prisma } from "@/infrastructure/db/prisma";
import { isUniqueViolation } from "@/infrastructure/db/prisma-errors";

function mapVehicleRow(row: {
  id: string;
  ownerId: string;
  vehicleTypeId: number;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoUrl: string | null;
  deletedAt: Date | null;
  vehicleType: { name: string };
}): VehicleRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    vehicleTypeId: row.vehicleTypeId,
    vehicleTypeName: row.vehicleType.name,
    brand: row.brand,
    model: row.model,
    color: row.color,
    plate: row.plate,
    photoUrl: row.photoUrl,
    deletedAt: row.deletedAt,
  };
}

export class PrismaVehicleRepository implements VehicleRepository {
  async findActiveTypes(): Promise<ActiveVehicleType[]> {
    return prisma.vehicleType.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
  }

  async isActiveType(vehicleTypeId: number): Promise<boolean> {
    const found = await prisma.vehicleType.findFirst({
      where: { id: vehicleTypeId, active: true },
      select: { id: true },
    });
    return found !== null;
  }

  async listByOwner(ownerId: string): Promise<VehicleRecord[]> {
    const rows = await prisma.vehicle.findMany({
      where: { ownerId, deletedAt: null },
      include: { vehicleType: { select: { name: true } } },
      orderBy: [{ brand: "asc" }, { model: "asc" }, { plate: "asc" }],
    });
    return rows.map(mapVehicleRow);
  }

  async findByIdAndOwner(vehicleId: string, ownerId: string): Promise<VehicleRecord | null> {
    const row = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerId, deletedAt: null },
      include: { vehicleType: { select: { name: true } } },
    });
    return row ? mapVehicleRow(row) : null;
  }

  async create(data: CreateVehicleData): Promise<VehicleRecord> {
    try {
      const created = await prisma.vehicle.create({
        data: {
          ownerId: data.ownerId,
          vehicleTypeId: data.vehicleTypeId,
          brand: data.brand,
          model: data.model,
          color: data.color,
          plate: data.plate,
          photoUrl: data.photoUrl,
        },
        include: { vehicleType: { select: { name: true } } },
      });
      return mapVehicleRow(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("DUPLICATE_PLATE", "Ya registraste un vehículo con esas placas.");
      }
      throw error;
    }
  }

  async update(
    vehicleId: string,
    ownerId: string,
    data: UpdateVehicleData,
  ): Promise<VehicleRecord | null> {
    try {
      const result = await prisma.vehicle.updateMany({
        where: { id: vehicleId, ownerId, deletedAt: null },
        data: {
          vehicleTypeId: data.vehicleTypeId,
          brand: data.brand,
          model: data.model,
          color: data.color,
          plate: data.plate,
          photoUrl: data.photoUrl,
        },
      });
      if (result.count === 0) {
        return null;
      }
      return this.findByIdAndOwner(vehicleId, ownerId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("DUPLICATE_PLATE", "Ya registraste un vehículo con esas placas.");
      }
      throw error;
    }
  }

  async softDelete(vehicleId: string, ownerId: string, deletedAt: Date): Promise<boolean> {
    const result = await prisma.vehicle.updateMany({
      where: { id: vehicleId, ownerId, deletedAt: null },
      data: { deletedAt },
    });
    return result.count > 0;
  }
}
