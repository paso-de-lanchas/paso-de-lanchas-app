import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/shared/domain-error";
import type {
  VesselRecord,
  VesselStatusHistoryEntry,
  VesselStatusRepository,
  VesselTripHistoryEntry,
} from "@/application/fleet/ports";
import type { VesselStatus } from "@/domain/fleet/vessel-status";

export class PrismaVesselStatusRepository implements VesselStatusRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findVesselById(vesselId: string): Promise<VesselRecord | null> {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!vessel) {
      return null;
    }

    return {
      id: vessel.id,
      code: vessel.code,
      name: vessel.name,
      status: vessel.status as VesselStatus,
    };
  }

  async changeStatusWithHistory(params: {
    vesselId: string;
    fromStatus: VesselStatus;
    toStatus: VesselStatus;
    reason: string;
    changedById: string;
  }): Promise<VesselStatusHistoryEntry> {
    return this.prisma.$transaction(async (tx) => {
      const updatedVessel = await tx.vessel.updateMany({
        where: {
          id: params.vesselId,
          status: params.fromStatus,
        },
        data: {
          status: params.toStatus,
        },
      });

      if (updatedVessel.count === 0) {
        throw new DomainError(
          "VESSEL_STATUS_CONFLICT",
          "El estado de la embarcación cambió. Recarga la información e inténtalo nuevamente.",
        );
      }

      const createdHistory = await tx.vesselStatusHistory.create({
        data: {
          vesselId: params.vesselId,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          reason: params.reason,
          changedById: params.changedById,
        },
        include: {
          changedBy: {
            select: { fullName: true },
          },
        },
      });

      return {
        id: createdHistory.id,
        vesselId: createdHistory.vesselId,
        fromStatus: createdHistory.fromStatus as VesselStatus,
        toStatus: createdHistory.toStatus as VesselStatus,
        reason: createdHistory.reason,
        changedById: createdHistory.changedById,
        changedByName: createdHistory.changedBy?.fullName ?? null,
        changedAt: createdHistory.changedAt,
      };
    });
  }

  async getStatusHistory(vesselId: string): Promise<VesselStatusHistoryEntry[]> {
    const rows = await this.prisma.vesselStatusHistory.findMany({
      where: { vesselId },
      orderBy: { changedAt: "desc" },
      include: {
        changedBy: {
          select: { fullName: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      vesselId: row.vesselId,
      fromStatus: row.fromStatus as VesselStatus,
      toStatus: row.toStatus as VesselStatus,
      reason: row.reason,
      changedById: row.changedById,
      changedByName: row.changedBy?.fullName ?? null,
      changedAt: row.changedAt,
    }));
  }

  async getTripsByVesselId(vesselId: string): Promise<VesselTripHistoryEntry[]> {
    const departures = await this.prisma.departure.findMany({
      where: { vesselId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        departedAt: true,
        arrivedAt: true,
        createdAt: true,
        originDock: { select: { name: true } },
        destinationDock: { select: { name: true } },
      },
    });

    return departures.map((dep) => ({
      id: dep.id,
      originDockName: dep.originDock.name,
      destinationDockName: dep.destinationDock.name,
      status: dep.status,
      departedAt: dep.departedAt,
      arrivedAt: dep.arrivedAt,
      createdAt: dep.createdAt,
    }));
  }
}
