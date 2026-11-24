import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { DepartureStatus } from "@/domain/departures/departure-state";
import type { VesselKind } from "@/domain/fleet/vessel";
import type {
  CreateDepartureData,
  CreateNotificationInput,
  CreateWaitlistEntryData,
  DepartureBoardingForCancel,
  DepartureBoardingItem,
  DepartureRecord,
  DepartureRepository,
  DepartureUnitOfWork,
  DockSummary,
  EligibleVessel,
  RefundPassengerInput,
  WaitlistEntryRecord,
} from "@/application/departures/ports";

type TxClient = Prisma.TransactionClient | PrismaClient;

function asTx(tx: unknown, fallback: PrismaClient): TxClient {
  if (tx && typeof tx === "object" && "$queryRaw" in tx) {
    return tx as TxClient;
  }
  return fallback;
}

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
  returnOfId?: string | null;
  cancelReason?: string | null;
  boardingStartedAt: Date | null;
  boardingClosedAt: Date | null;
  createdAt: Date;
  vehicleCapacity?: Array<{
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
    returnOfId: row.returnOfId ?? null,
    cancelReason: row.cancelReason ?? null,
    boardingStartedAt: row.boardingStartedAt,
    boardingClosedAt: row.boardingClosedAt,
    createdAt: row.createdAt,
    vehicleCapacities: (row.vehicleCapacity ?? []).map((vc) => ({
      vehicleTypeId: vc.vehicleTypeId,
      capacity: vc.capacity,
      occupied: vc.occupied,
    })),
  };
}

function toWaitlistRecord(row: {
  id: string;
  dockId: string;
  passengerId: string | null;
  label: string | null;
  status: string;
  priority: number;
  originBoardingId: string | null;
  boardingId: string | null;
  createdById: string;
  createdAt: Date;
}): WaitlistEntryRecord {
  return {
    id: row.id,
    dockId: row.dockId,
    passengerId: row.passengerId,
    label: row.label,
    status: row.status as WaitlistEntryRecord["status"],
    priority: row.priority,
    originBoardingId: row.originBoardingId,
    boardingId: row.boardingId,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

const departureInclude = {
  vehicleCapacity: {
    select: {
      vehicleTypeId: true,
      capacity: true,
      occupied: true,
    },
    orderBy: { vehicleTypeId: "asc" as const },
  },
};

export class PrismaDepartureRepository implements DepartureRepository {
  readonly unitOfWork: DepartureUnitOfWork;

  constructor(private readonly prisma: PrismaClient) {
    this.unitOfWork = {
      run: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
        return this.prisma.$transaction(async (tx) => work(tx));
      },

      lockDepartureForUpdate: async (
        tx: unknown,
        departureId: string,
      ): Promise<DepartureRecord | null> => {
        const client = asTx(tx, this.prisma);
        const rows = await client.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM departures WHERE id = ${departureId}::uuid FOR UPDATE
        `;
        if (rows.length === 0) return null;
        return this.findDepartureByIdWithClient(client, departureId);
      },

      markDepartureCancelled: async (
        tx: unknown,
        params: {
          departureId: string;
          fromStatus: DepartureStatus;
          cancelReason: string;
        },
      ): Promise<DepartureRecord> => {
        const client = asTx(tx, this.prisma);
        const updated = await client.departure.updateMany({
          where: {
            id: params.departureId,
            status: params.fromStatus,
          },
          data: {
            status: "CANCELLED",
            queuePosition: null,
            cancelReason: params.cancelReason,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          throw new DomainError(
            "DEPARTURE_CONFLICT",
            "El estado de la salida cambiÃ³ de forma concurrente al intentar cancelarla.",
          );
        }
        const record = await this.findDepartureByIdWithClient(client, params.departureId);
        if (!record) {
          throw new DomainError(
            "DEPARTURE_NOT_FOUND",
            "No se encontrÃ³ la salida tras cancelarla.",
          );
        }
        return record;
      },

      listBoardingsForDeparture: async (
        tx: unknown,
        departureId: string,
      ): Promise<DepartureBoardingForCancel[]> => {
        const client = asTx(tx, this.prisma);
        const rows = await client.boarding.findMany({
          where: { departureId },
          orderBy: { seatNumber: "asc" },
        });
        const saleIds = Array.from(new Set(rows.map((b) => b.saleId)));
        const sales =
          saleIds.length > 0
            ? await client.sale.findMany({
                where: { id: { in: saleIds } },
                select: { id: true, channel: true },
              })
            : [];
        const saleChannelMap = new Map(sales.map((s) => [s.id, s.channel]));

        return rows.map((b) => ({
          id: b.id,
          departureId: b.departureId,
          saleId: b.saleId,
          saleChannel:
            saleChannelMap.get(b.saleId) === "QR_BALANCE" ? "QR_BALANCE" : "TICKET_OFFICE",
          passengerId: b.passengerId,
          seatNumber: b.seatNumber,
          amountCharged: b.amountCharged.toString(),
          status: b.status as DepartureBoardingForCancel["status"],
        }));
      },

      markBoardingCancelled: async (
        tx: unknown,
        params: { boardingId: string; cancelReason: string },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.boarding.update({
          where: { id: params.boardingId },
          data: {
            status: "CANCELLED",
            cancelReason: params.cancelReason,
          },
        });
      },

      creditWalletRefund: async (tx: unknown, input: RefundPassengerInput): Promise<void> => {
        const client = asTx(tx, this.prisma);
        const wallet = await client.wallet.findUnique({
          where: { userId: input.passengerId },
        });
        if (!wallet) {
          throw new DomainError(
            "WALLET_NOT_FOUND",
            "No se encontrÃ³ el monedero del pasajero para reembolsar.",
          );
        }

        const currentBalance = Money.fromPesos(wallet.balance);
        const refundAmount = Money.fromPesos(input.amountPesos);
        const nextBalance = currentBalance.add(refundAmount);

        const updatedWallet = await client.wallet.updateMany({
          where: {
            id: wallet.id,
            version: wallet.version,
          },
          data: {
            balance: nextBalance.toDecimalString(),
            version: { increment: 1 },
          },
        });

        if (updatedWallet.count === 0) {
          throw new DomainError(
            "WALLET_CONFLICT",
            "Conflicto de concurrencia al actualizar el monedero durante el reembolso.",
          );
        }

        await client.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: refundAmount.toDecimalString(),
            balanceAfter: nextBalance.toDecimalString(),
            saleId: input.saleId,
            performedById: input.performedById,
            reason: input.reason,
          },
        });
      },

      recordCashRefund: async (
        tx: unknown,
        input: {
          boardingId: string;
          saleId: string;
          departureId: string | null;
          passengerId: string | null;
          seatNumber: number;
          amountPesos: string;
          reason: string;
          performedById: string;
        },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.auditLog.create({
          data: {
            userId: input.performedById,
            action: "CASH_REFUND_READY",
            entity: "boardings",
            entityId: input.boardingId,
            details: {
              boardingId: input.boardingId,
              saleId: input.saleId,
              departureId: input.departureId,
              passengerId: input.passengerId,
              seatNumber: input.seatNumber,
              amount: input.amountPesos,
              refundMethod: "CASH_BOX",
              reason: input.reason,
            },
          },
        });
      },

      createNotification: async (tx: unknown, input: CreateNotificationInput): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.notification.create({
          data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
          },
        });
      },

      markDepartureFinished: async (
        tx: unknown,
        params: {
          departureId: string;
          finishedAt: Date;
          actorUserId: string;
        },
      ): Promise<DepartureRecord> => {
        const client = asTx(tx, this.prisma);
        const updated = await client.departure.updateMany({
          where: {
            id: params.departureId,
            status: "IN_TRANSIT",
          },
          data: {
            status: "FINISHED",
            queuePosition: null,
            arrivedAt: params.finishedAt,
            finishedById: params.actorUserId,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          throw new DomainError(
            "DEPARTURE_CONFLICT",
            "No se pudo marcar el viaje como finalizado.",
          );
        }
        const record = await this.findDepartureByIdWithClient(client, params.departureId);
        if (!record) {
          throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontrÃ³ la salida finalizada.");
        }
        return record;
      },

      createReturnQueuedDeparture: async (
        tx: unknown,
        data: CreateDepartureData,
      ): Promise<DepartureRecord> => {
        const client = asTx(tx, this.prisma);
        const created = await client.departure.create({
          data: {
            vesselId: data.vesselId,
            driverId: data.driverId,
            originDockId: data.originDockId,
            destinationDockId: data.destinationDockId,
            status: data.status,
            queuePosition: data.queuePosition,
            passengerCapacity: data.passengerCapacity,
            returnOfId: data.returnOfId ?? null,
            boardingStartedAt: data.boardingStartedAt,
            vehicleCapacity: {
              create: data.vehicleCapacities.map((vc) => ({
                vehicleTypeId: vc.vehicleTypeId,
                capacity: vc.capacity,
                occupied: 0,
              })),
            },
          },
          include: departureInclude,
        });
        return toDepartureRecord(created);
      },
    };
  }

  private async findDepartureByIdWithClient(
    client: TxClient,
    departureId: string,
  ): Promise<DepartureRecord | null> {
    const row = await client.departure.findUnique({
      where: { id: departureId },
      include: departureInclude,
    });
    return row ? toDepartureRecord(row) : null;
  }

  async findDockById(dockId: string): Promise<DockSummary | null> {
    return this.prisma.dock.findUnique({
      where: { id: dockId },
      select: { id: true, code: true, name: true },
    });
  }

  async listDocks(): Promise<DockSummary[]> {
    return this.prisma.dock.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async findEligibleVessel(vesselId: string): Promise<EligibleVessel | null> {
    const vessel = await this.prisma.vessel.findFirst({
      where: {
        id: vesselId,
        status: "ACTIVE",
      },
      include: {
        drivers: {
          where: { unassignedAt: null },
          select: { driverId: true },
          take: 1,
        },
        vehicleCapacity: {
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
      where: {
        status: "ACTIVE",
      },
      include: {
        drivers: {
          where: { unassignedAt: null },
          select: { driverId: true },
          take: 1,
        },
        vehicleCapacity: {
          select: { vehicleTypeId: true, capacity: true },
        },
      },
      orderBy: { code: "asc" },
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
      where: { originDockId: dockId },
      include: departureInclude,
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toDepartureRecord);
  }

  async findDepartureById(departureId: string): Promise<DepartureRecord | null> {
    const row = await this.prisma.departure.findUnique({
      where: { id: departureId },
      include: departureInclude,
    });
    return row ? toDepartureRecord(row) : null;
  }

  async findActiveBoardingByDock(dockId: string): Promise<DepartureRecord | null> {
    const row = await this.prisma.departure.findFirst({
      where: {
        originDockId: dockId,
        status: "BOARDING",
      },
      include: departureInclude,
    });
    return row ? toDepartureRecord(row) : null;
  }

  async createDeparture(data: CreateDepartureData): Promise<DepartureRecord> {
    const created = await this.prisma.departure.create({
      data: {
        vesselId: data.vesselId,
        driverId: data.driverId,
        originDockId: data.originDockId,
        destinationDockId: data.destinationDockId,
        status: data.status,
        queuePosition: data.queuePosition,
        passengerCapacity: data.passengerCapacity,
        returnOfId: data.returnOfId ?? null,
        boardingStartedAt: data.boardingStartedAt,
        vehicleCapacity: {
          create: data.vehicleCapacities.map((vc) => ({
            vehicleTypeId: vc.vehicleTypeId,
            capacity: vc.capacity,
            occupied: 0,
          })),
        },
      },
      include: departureInclude,
    });
    return toDepartureRecord(created);
  }

  async updateDepartureStatus(params: {
    departureId: string;
    fromStatus: DepartureStatus;
    toStatus: DepartureStatus;
    queuePosition: number | null;
    boardingStartedAt?: Date | null;
    boardingClosedAt?: Date | null;
  }): Promise<DepartureRecord> {
    const updated = await this.prisma.departure.updateMany({
      where: {
        id: params.departureId,
        status: params.fromStatus,
      },
      data: {
        status: params.toStatus,
        queuePosition: params.queuePosition,
        ...(params.boardingStartedAt !== undefined
          ? { boardingStartedAt: params.boardingStartedAt }
          : {}),
        ...(params.boardingClosedAt !== undefined
          ? { boardingClosedAt: params.boardingClosedAt }
          : {}),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new DomainError(
        "DEPARTURE_CONFLICT",
        "No se pudo actualizar el estado de la salida por un cambio concurrente.",
      );
    }

    const row = await this.prisma.departure.findUnique({
      where: { id: params.departureId },
      include: departureInclude,
    });
    if (!row) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontrÃ³ la salida actualizada.");
    }
    return toDepartureRecord(row);
  }

  async applyQueuePositions(
    dockId: string,
    positions: Array<{ id: string; queuePosition: number }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const pos of positions) {
        await tx.departure.updateMany({
          where: {
            id: pos.id,
            originDockId: dockId,
            status: "QUEUED",
          },
          data: {
            queuePosition: pos.queuePosition,
            version: { increment: 1 },
          },
        });
      }
    });
  }

  async listWaitlistByDock(dockId: string): Promise<WaitlistEntryRecord[]> {
    const rows = await this.prisma.waitlistEntry.findMany({
      where: { dockId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toWaitlistRecord);
  }

  async createWaitlistEntry(data: CreateWaitlistEntryData): Promise<WaitlistEntryRecord> {
    const created = await this.prisma.waitlistEntry.create({
      data: {
        dockId: data.dockId,
        passengerId: data.passengerId,
        label: data.label,
        status: "WAITING",
        createdById: data.createdById,
      },
    });
    return toWaitlistRecord(created);
  }

  async findBoardingForUpdate(tx: unknown, dockId: string): Promise<DepartureRecord | null> {
    const client = asTx(tx, this.prisma);
    const rows = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM departures
      WHERE origin_dock_id = ${dockId}::uuid
        AND status = 'BOARDING'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE
    `;
    if (rows.length === 0) return null;
    return this.findDepartureByIdWithClient(client, rows[0].id);
  }

  async occupySeat(tx: unknown, departureId: string): Promise<number> {
    const client = asTx(tx, this.prisma);
    const rows = await client.$queryRaw<
      Array<{
        id: string;
        origin_dock_id: string;
        status: string;
        passenger_capacity: number;
        occupied_seats: number;
      }>
    >`
      SELECT id, origin_dock_id, status, passenger_capacity, occupied_seats
      FROM departures
      WHERE id = ${departureId}::uuid
      FOR UPDATE
    `;

    const current = rows[0];
    if (!current) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontrÃ³ la salida para asignar lugar.");
    }
    if (current.status !== "BOARDING") {
      throw new DomainError(
        "DEPARTURE_NOT_BOARDING",
        "La salida no se encuentra en estado de abordaje.",
      );
    }
    if (current.occupied_seats >= current.passenger_capacity) {
      throw new DomainError(
        "DEPARTURE_CAPACITY_FULL",
        "La salida ya alcanzÃ³ su capacidad mÃ¡xima de pasajeros.",
      );
    }

    const nextSeat = current.occupied_seats + 1;
    await client.departure.update({
      where: { id: current.id },
      data: {
        occupiedSeats: nextSeat,
        version: { increment: 1 },
      },
    });

    if (nextSeat >= current.passenger_capacity) {
      await client.departure.update({
        where: { id: current.id },
        data: {
          status: "BOARDING_CLOSED",
          queuePosition: null,
          boardingClosedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const nextQueued = await client.departure.findFirst({
        where: {
          originDockId: current.origin_dock_id,
          status: "QUEUED",
        },
        orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      });

      if (nextQueued) {
        await client.departure.update({
          where: { id: nextQueued.id },
          data: {
            status: "BOARDING",
            queuePosition: null,
            boardingStartedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
    }

    return nextSeat;
  }

  async listBoardingsByDepartureId(departureId: string): Promise<DepartureBoardingItem[]> {
    const rows = await this.prisma.boarding.findMany({
      where: { departureId },
      orderBy: { seatNumber: "asc" },
    });

    const saleIds = Array.from(new Set(rows.map((r) => r.saleId)));
    const passengerIds = Array.from(
      new Set(rows.map((r) => r.passengerId).filter((id): id is string => Boolean(id))),
    );
    const vehicleIds = Array.from(
      new Set(rows.map((r) => r.vehicleId).filter((id): id is string => Boolean(id))),
    );

    const [sales, passengers, vehicles] = await Promise.all([
      saleIds.length > 0
        ? this.prisma.sale.findMany({
            where: { id: { in: saleIds } },
            select: { id: true, channel: true },
          })
        : Promise.resolve([]),
      passengerIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: passengerIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      vehicleIds.length > 0
        ? this.prisma.vehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: { id: true, brand: true, model: true, plate: true },
          })
        : Promise.resolve([]),
    ]);

    const saleChannelMap = new Map(sales.map((s) => [s.id, s.channel]));
    const passengerNameMap = new Map(passengers.map((p) => [p.id, p.fullName]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    return rows.map((row) => {
      const channel = saleChannelMap.get(row.saleId);
      const isTicketOffice = channel === "TICKET_OFFICE" || row.passengerId === null;
      const rawName = row.passengerId ? passengerNameMap.get(row.passengerId) : null;
      const passengerName = rawName?.trim() || (isTicketOffice ? "Boleto de taquilla" : "Pasajero");
      const vehicle = row.vehicleId ? vehicleMap.get(row.vehicleId) : null;
      const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : null;

      return {
        id: row.id,
        seatNumber: row.seatNumber,
        passengerName,
        passengerId: row.passengerId,
        isTicketOffice,
        fareCategory: row.fareCategory,
        amountCharged: Money.fromPesos(row.amountCharged).toDecimalString(),
        status: row.status as DepartureBoardingItem["status"],
        vehicleId: row.vehicleId,
        vehicleLabel,
        vehiclePlate: vehicle?.plate ?? null,
      };
    });
  }
}
