import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/shared/domain-error";
import type { DepartureStatus } from "@/domain/departures/departure-state";
import type { VesselKind } from "@/domain/fleet/vessel";
import type {
  CreateDepartureData,
  CreateWaitlistEntryData,
  DepartureRecord,
  DepartureRepository,
  DockSummary,
  EligibleVessel,
  WaitlistEntryRecord,
} from "@/application/departures/ports";

const ACTIVE_DEPARTURE_STATUSES: DepartureStatus[] = [
  "QUEUED",
  "BOARDING",
  "BOARDING_CLOSED",
  "IN_TRANSIT",
];

function toDepartureRecord(row: {
  id: string;
  vesselId: string;
  driverId: string | null;
  originDockId: string;
  destinationDockId: string;
  status: string;
  queuePosition: number | null;
  passengerCapacity: number;
  occupiedSeats: number;
  boardingStartedAt: Date | null;
  boardingClosedAt: Date | null;
  createdAt: Date;
  vehicleCapacity: Array<{
    vehicleTypeId: number;
    capacity: number;
    occupied: number;
  }>;
}): DepartureRecord {
  return {
    id: row.id,
    vesselId: row.vesselId,
    driverId: row.driverId,
    originDockId: row.originDockId,
    destinationDockId: row.destinationDockId,
    status: row.status as DepartureStatus,
    queuePosition: row.queuePosition,
    passengerCapacity: row.passengerCapacity,
    occupiedSeats: row.occupiedSeats,
    boardingStartedAt: row.boardingStartedAt,
    boardingClosedAt: row.boardingClosedAt,
    createdAt: row.createdAt,
    vehicleCapacities: row.vehicleCapacity.map((vc) => ({
      vehicleTypeId: vc.vehicleTypeId,
      capacity: vc.capacity,
      occupied: vc.occupied,
    })),
  };
}

async function lockDock(tx: Prisma.TransactionClient, dockId: string): Promise<void> {
  await tx.$executeRaw`SELECT id FROM docks WHERE id = ${dockId}::uuid FOR UPDATE`;
}

export class PrismaDepartureRepository implements DepartureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDockById(dockId: string): Promise<DockSummary | null> {
    return this.prisma.dock.findUnique({
      where: { id: dockId },
      select: { id: true, code: true, name: true },
    });
  }

  async listDocks(): Promise<DockSummary[]> {
    return this.prisma.dock.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
  }

  async findEligibleVessel(vesselId: string): Promise<EligibleVessel | null> {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        drivers: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: { driverId: true },
        },
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true },
        },
      },
    });
    if (!vessel) return null;
    return {
      id: vessel.id,
      code: vessel.code,
      name: vessel.name,
      kind: vessel.kind as VesselKind,
      status: vessel.status,
      passengerCapacity: vessel.passengerCapacity,
      activeDriverId: vessel.drivers[0]?.driverId ?? null,
      vehicleCapacities: vessel.vehicleCapacity,
    };
  }

  async listEligibleVessels(): Promise<EligibleVessel[]> {
    const vessels = await this.prisma.vessel.findMany({
      where: { status: "ACTIVE" },
      orderBy: { code: "asc" },
      include: {
        drivers: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: { driverId: true },
        },
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true },
        },
      },
    });
    return vessels.map((vessel) => ({
      id: vessel.id,
      code: vessel.code,
      name: vessel.name,
      kind: vessel.kind as VesselKind,
      status: vessel.status,
      passengerCapacity: vessel.passengerCapacity,
      activeDriverId: vessel.drivers[0]?.driverId ?? null,
      vehicleCapacities: vessel.vehicleCapacity,
    }));
  }

  async listDeparturesByDock(dockId: string): Promise<DepartureRecord[]> {
    const rows = await this.prisma.departure.findMany({
      where: {
        originDockId: dockId,
        status: { in: ACTIVE_DEPARTURE_STATUSES },
      },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      include: {
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true, occupied: true },
        },
      },
    });
    return rows.map(toDepartureRecord);
  }

  async findActiveDepartureByVessel(vesselId: string): Promise<DepartureRecord | null> {
    const row = await this.prisma.departure.findFirst({
      where: {
        vesselId,
        status: { in: ACTIVE_DEPARTURE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      include: {
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true, occupied: true },
        },
      },
    });
    return row ? toDepartureRecord(row) : null;
  }

  async findDepartureById(departureId: string): Promise<DepartureRecord | null> {
    const row = await this.prisma.departure.findUnique({
      where: { id: departureId },
      include: {
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true, occupied: true },
        },
      },
    });
    return row ? toDepartureRecord(row) : null;
  }

  async findActiveBoardingByDock(dockId: string): Promise<DepartureRecord | null> {
    const row = await this.prisma.departure.findFirst({
      where: { originDockId: dockId, status: "BOARDING" },
      include: {
        vehicleCapacity: {
          orderBy: { vehicleTypeId: "asc" },
          select: { vehicleTypeId: true, capacity: true, occupied: true },
        },
      },
    });
    return row ? toDepartureRecord(row) : null;
  }

  async createDeparture(data: CreateDepartureData): Promise<DepartureRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      await lockDock(tx, data.originDockId);
      const existingBoarding = await tx.departure.findFirst({
        where: { originDockId: data.originDockId, status: "BOARDING" },
        select: { id: true },
      });
      if (data.status === "BOARDING" && existingBoarding) {
        throw new DomainError(
          "BOARDING_ALREADY_ACTIVE",
          "Ya existe una salida abordando en este muelle.",
        );
      }
      return tx.departure.create({
        data: {
          vesselId: data.vesselId,
          driverId: data.driverId,
          originDockId: data.originDockId,
          destinationDockId: data.destinationDockId,
          status: data.status,
          queuePosition: data.queuePosition,
          passengerCapacity: data.passengerCapacity,
          boardingStartedAt: data.boardingStartedAt,
          vehicleCapacity:
            data.vehicleCapacities.length > 0
              ? {
                  create: data.vehicleCapacities.map((vc) => ({
                    vehicleTypeId: vc.vehicleTypeId,
                    capacity: vc.capacity,
                    occupied: 0,
                  })),
                }
              : undefined,
        },
        include: {
          vehicleCapacity: {
            orderBy: { vehicleTypeId: "asc" },
            select: { vehicleTypeId: true, capacity: true, occupied: true },
          },
        },
      });
    });
    return toDepartureRecord(created);
  }

  async enqueueDepartureInTx(params: {
    vesselId: string;
    driverId: string;
    originDockId: string;
    destinationDockId: string;
    passengerCapacity: number;
    vehicleCapacities: Array<{ vehicleTypeId: number; capacity: number }>;
    startedAt: Date;
  }): Promise<DepartureRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      await lockDock(tx, params.originDockId);

      const activeVessel = await tx.departure.findFirst({
        where: {
          vesselId: params.vesselId,
          status: { in: ACTIVE_DEPARTURE_STATUSES },
        },
        select: { id: true },
      });
      if (activeVessel) {
        throw new DomainError(
          "VESSEL_ALREADY_IN_OPERATION",
          "La embarcación ya tiene una salida activa o en fila en algún muelle.",
        );
      }

      const queuedCount = await tx.departure.count({
        where: { originDockId: params.originDockId, status: "QUEUED" },
      });
      const nextPosition = queuedCount + 1;

      const row = await tx.departure.create({
        data: {
          vesselId: params.vesselId,
          driverId: params.driverId,
          originDockId: params.originDockId,
          destinationDockId: params.destinationDockId,
          status: "QUEUED",
          queuePosition: nextPosition,
          passengerCapacity: params.passengerCapacity,
          boardingStartedAt: null,
          vehicleCapacity:
            params.vehicleCapacities.length > 0
              ? {
                  create: params.vehicleCapacities.map((vc) => ({
                    vehicleTypeId: vc.vehicleTypeId,
                    capacity: vc.capacity,
                    occupied: 0,
                  })),
                }
              : undefined,
        },
        include: {
          vehicleCapacity: {
            orderBy: { vehicleTypeId: "asc" },
            select: { vehicleTypeId: true, capacity: true, occupied: true },
          },
        },
      });

      const activeBoarding = await tx.departure.findFirst({
        where: { originDockId: params.originDockId, status: "BOARDING" },
        select: { id: true },
      });

      if (!activeBoarding && row.queuePosition === 1) {
        const promoted = await tx.departure.update({
          where: { id: row.id },
          data: {
            status: "BOARDING",
            queuePosition: null,
            boardingStartedAt: params.startedAt,
            version: { increment: 1 },
          },
          include: {
            vehicleCapacity: {
              orderBy: { vehicleTypeId: "asc" },
              select: { vehicleTypeId: true, capacity: true, occupied: true },
            },
          },
        });
        return promoted;
      }

      return row;
    });

    return toDepartureRecord(created);
  }

  async startNextBoardingInTx(params: {
    dockId: string;
    startedAt: Date;
    pickNext: (queued: DepartureRecord[]) => DepartureRecord | null;
    reorderRemaining: (
      remaining: DepartureRecord[],
    ) => Array<{ id: string; queuePosition: number }>;
  }): Promise<DepartureRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      await lockDock(tx, params.dockId);

      const currentBoarding = await tx.departure.findFirst({
        where: { originDockId: params.dockId, status: "BOARDING" },
        select: { id: true },
      });
      if (currentBoarding) {
        return null;
      }

      const queuedRows = await tx.departure.findMany({
        where: { originDockId: params.dockId, status: "QUEUED" },
        orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
        include: {
          vehicleCapacity: {
            orderBy: { vehicleTypeId: "asc" },
            select: { vehicleTypeId: true, capacity: true, occupied: true },
          },
        },
      });

      const queued = queuedRows.map(toDepartureRecord);
      const next = params.pickNext(queued);
      if (!next) {
        return null;
      }

      const updated = await tx.departure.update({
        where: { id: next.id },
        data: {
          status: "BOARDING",
          queuePosition: null,
          boardingStartedAt: params.startedAt,
          version: { increment: 1 },
        },
        include: {
          vehicleCapacity: {
            orderBy: { vehicleTypeId: "asc" },
            select: { vehicleTypeId: true, capacity: true, occupied: true },
          },
        },
      });

      const remaining = queued.filter((item) => item.id !== next.id);
      if (remaining.length > 0) {
        const reordered = params.reorderRemaining(remaining);
        for (const item of reordered) {
          await tx.departure.updateMany({
            where: { id: item.id, originDockId: params.dockId, status: "QUEUED" },
            data: { queuePosition: item.queuePosition, version: { increment: 1 } },
          });
        }
      }

      return toDepartureRecord(updated);
    });
  }

  async updateDepartureStatus(params: {
    departureId: string;
    fromStatus: DepartureStatus;
    toStatus: DepartureStatus;
    queuePosition: number | null;
    boardingStartedAt?: Date | null;
    boardingClosedAt?: Date | null;
  }): Promise<DepartureRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.departure.findUnique({
        where: { id: params.departureId },
      });
      if (!current) {
        throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
      }
      await lockDock(tx, current.originDockId);

      if (current.status !== params.fromStatus) {
        throw new DomainError(
          "CONCURRENT_DEPARTURE_UPDATE",
          "El estado de la salida cambió de forma concurrente.",
        );
      }
      if (params.toStatus === "BOARDING") {
        const anotherBoarding = await tx.departure.findFirst({
          where: {
            originDockId: current.originDockId,
            status: "BOARDING",
            id: { not: current.id },
          },
          select: { id: true },
        });
        if (anotherBoarding) {
          throw new DomainError(
            "BOARDING_ALREADY_ACTIVE",
            "Ya hay otra embarcación abordando en el muelle.",
          );
        }
      }
      const updated = await tx.departure.update({
        where: { id: params.departureId, version: current.version },
        data: {
          status: params.toStatus,
          queuePosition: params.queuePosition,
          version: { increment: 1 },
          ...(params.boardingStartedAt !== undefined
            ? { boardingStartedAt: params.boardingStartedAt }
            : {}),
          ...(params.boardingClosedAt !== undefined
            ? { boardingClosedAt: params.boardingClosedAt }
            : {}),
        },
        include: {
          vehicleCapacity: {
            orderBy: { vehicleTypeId: "asc" },
            select: { vehicleTypeId: true, capacity: true, occupied: true },
          },
        },
      });
      return toDepartureRecord(updated);
    });
  }

  async applyQueuePositions(
    dockId: string,
    positions: Array<{ id: string; queuePosition: number }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDock(tx, dockId);
      for (const item of positions) {
        await tx.departure.updateMany({
          where: { id: item.id, originDockId: dockId, status: "QUEUED" },
          data: { queuePosition: item.queuePosition, version: { increment: 1 } },
        });
      }
    });
  }

  async listWaitlistByDock(dockId: string): Promise<WaitlistEntryRecord[]> {
    const rows = await this.prisma.waitlistEntry.findMany({
      where: { dockId, status: "WAITING" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      dockId: row.dockId,
      passengerId: row.passengerId,
      label: row.label,
      status: row.status,
      priority: row.priority,
      originBoardingId: row.originBoardingId,
      boardingId: row.boardingId,
      createdById: row.createdById,
      createdAt: row.createdAt,
    }));
  }

  async createWaitlistEntry(data: CreateWaitlistEntryData): Promise<WaitlistEntryRecord> {
    const row = await this.prisma.waitlistEntry.create({
      data: {
        dockId: data.dockId,
        passengerId: data.passengerId,
        label: data.label,
        status: "WAITING",
        priority: 0,
        createdById: data.createdById,
      },
    });
    return {
      id: row.id,
      dockId: row.dockId,
      passengerId: row.passengerId,
      label: row.label,
      status: row.status,
      priority: row.priority,
      originBoardingId: row.originBoardingId,
      boardingId: row.boardingId,
      createdById: row.createdById,
      createdAt: row.createdAt,
    };
  }
}
