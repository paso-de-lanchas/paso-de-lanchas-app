import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/shared/domain-error";
import type {
  CreateVesselData,
  UpdateVesselData,
  VehicleTypeOption,
  VesselDetail,
  VesselFilters,
  VesselRepository,
} from "@/application/fleet/vessel-ports";
import type { VesselKind, VesselStatus } from "@/domain/fleet/vessel";

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(", ")
      : String(error.meta?.target ?? "");

    if (target.includes("code")) {
      throw new DomainError(
        "DUPLICATE_VESSEL_CODE",
        "Ya existe una embarcación registrada con ese código.",
      );
    }

    if (target.includes("registration")) {
      throw new DomainError(
        "DUPLICATE_VESSEL_REGISTRATION",
        "Ya existe una embarcación registrada con esa matrícula.",
      );
    }

    throw new DomainError(
      "DUPLICATE_VESSEL",
      "El código o la matrícula ya están registrados en otra embarcación.",
    );
  }

  throw error;
}

function toVesselDetail(row: {
  id: string;
  code: string;
  name: string;
  kind: string;
  registration: string;
  color: string | null;
  photoUrl: string | null;
  passengerCapacity: number;
  status: string;
  createdAt: Date;
  vehicleCapacity: Array<{
    vehicleTypeId: number;
    capacity: number;
    vehicleType: { name: string };
  }>;
}): VesselDetail {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind as VesselKind,
    registration: row.registration,
    color: row.color,
    photoUrl: row.photoUrl,
    passengerCapacity: row.passengerCapacity,
    status: row.status as VesselStatus,
    createdAt: row.createdAt,
    vehicleCapacities: row.vehicleCapacity.map((vc) => ({
      vehicleTypeId: vc.vehicleTypeId,
      vehicleTypeName: vc.vehicleType.name,
      capacity: vc.capacity,
    })),
  };
}

export class PrismaVesselRepository implements VesselRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateVesselData): Promise<VesselDetail> {
    try {
      const created = await this.prisma.vessel.create({
        data: {
          code: data.code,
          name: data.name,
          kind: data.kind,
          registration: data.registration,
          color: data.color,
          photoUrl: data.photoUrl,
          passengerCapacity: data.passengerCapacity,
          vehicleCapacity:
            data.kind === "FERRY" && data.vehicleCapacities.length > 0
              ? {
                  create: data.vehicleCapacities.map((vc) => ({
                    vehicleTypeId: vc.vehicleTypeId,
                    capacity: vc.capacity,
                  })),
                }
              : undefined,
        },
        include: {
          vehicleCapacity: {
            include: { vehicleType: { select: { name: true } } },
            orderBy: { vehicleTypeId: "asc" },
          },
        },
      });

      return toVesselDetail(created);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async update(data: UpdateVesselData): Promise<VesselDetail> {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.vesselVehicleCapacity.deleteMany({
          where: { vesselId: data.id },
        });

        return tx.vessel.update({
          where: { id: data.id },
          data: {
            code: data.code,
            name: data.name,
            kind: data.kind,
            registration: data.registration,
            color: data.color,
            photoUrl: data.photoUrl,
            passengerCapacity: data.passengerCapacity,
            vehicleCapacity:
              data.kind === "FERRY" && data.vehicleCapacities.length > 0
                ? {
                    create: data.vehicleCapacities.map((vc) => ({
                      vehicleTypeId: vc.vehicleTypeId,
                      capacity: vc.capacity,
                    })),
                  }
                : undefined,
          },
          include: {
            vehicleCapacity: {
              include: { vehicleType: { select: { name: true } } },
              orderBy: { vehicleTypeId: "asc" },
            },
          },
        });
      });

      return toVesselDetail(updated);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findById(id: string): Promise<VesselDetail | null> {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id },
      include: {
        vehicleCapacity: {
          include: { vehicleType: { select: { name: true } } },
          orderBy: { vehicleTypeId: "asc" },
        },
      },
    });

    return vessel ? toVesselDetail(vessel) : null;
  }

  async list(filters?: VesselFilters): Promise<VesselDetail[]> {
    const vessels = await this.prisma.vessel.findMany({
      where: {
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: [{ code: "asc" }],
      include: {
        vehicleCapacity: {
          include: { vehicleType: { select: { name: true } } },
          orderBy: { vehicleTypeId: "asc" },
        },
      },
    });

    return vessels.map(toVesselDetail);
  }

  async listVehicleTypes(): Promise<VehicleTypeOption[]> {
    return this.prisma.vehicleType.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, active: true },
    });
  }
}
