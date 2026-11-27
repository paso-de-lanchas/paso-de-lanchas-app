import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { DepartureStatus } from "@/domain/departures/departure-state";
import { DEFAULT_MAX_BOARDING_MINUTES } from "@/domain/schedule/boarding-timeout";
import type { ServiceHourWindow, ServiceOverrideType } from "@/domain/schedule/service-hours";
import type {
  CreateDockServiceOverrideInput,
  DockServiceOverrideRecord,
  ScheduleRepository,
} from "@/application/schedule/ports";
import type {
  IncidentActionType,
  IncidentBoardingItem,
  IncidentDepartureSnapshot,
  IncidentRecord,
  IncidentRepository,
  IncidentUnitOfWork,
} from "@/application/incidents/ports";

type TxClient = Prisma.TransactionClient | PrismaClient;

function asTx(tx: unknown, fallback: PrismaClient): TxClient {
  if (tx && typeof tx === "object" && "$queryRaw" in tx) {
    return tx as TxClient;
  }
  return fallback;
}

function parseMaxBoardingMinutesValue(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.minutes ?? obj.value ?? obj.maxBoardingMinutes;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.floor(candidate);
    }
  }
  return DEFAULT_MAX_BOARDING_MINUTES;
}

export class PrismaScheduleIncidentRepository implements ScheduleRepository, IncidentRepository {
  readonly unitOfWork: IncidentUnitOfWork;

  constructor(private readonly prisma: PrismaClient) {
    this.unitOfWork = {
      run: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
        return this.prisma.$transaction(async (tx) => work(tx));
      },

      setVesselMaintenance: async (tx: unknown, params: { vesselId: string }): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.vessel.update({
          where: { id: params.vesselId },
          data: { status: "MAINTENANCE" },
        });
      },

      createIncident: async (
        tx: unknown,
        data: {
          vesselId: string;
          departureId: string | null;
          type: string;
          description: string;
          action: IncidentActionType;
          reportedById: string;
        },
      ): Promise<IncidentRecord> => {
        const client = asTx(tx, this.prisma);
        const created = await client.incident.create({
          data: {
            vesselId: data.vesselId,
            departureId: data.departureId,
            type: data.type,
            description: data.description,
            action: data.action,
            reportedById: data.reportedById,
          },
        });
        return {
          id: created.id,
          vesselId: created.vesselId,
          departureId: created.departureId,
          type: created.type,
          description: created.description,
          action: created.action as IncidentActionType,
          reportedById: created.reportedById,
          createdAt: created.createdAt,
        };
      },

      lockDepartureForIncident: async (
        tx: unknown,
        departureId: string,
      ): Promise<IncidentDepartureSnapshot | null> => {
        const client = asTx(tx, this.prisma);
        const rows = await client.$queryRaw<
          Array<{
            id: string;
            vessel_id: string;
            origin_dock_id: string;
            status: string;
          }>
        >`
          SELECT id, vessel_id, origin_dock_id, status
          FROM departures
          WHERE id = ${departureId}::uuid
          FOR UPDATE
        `;
        const row = rows[0];
        if (!row) return null;
        return {
          id: row.id,
          vesselId: row.vessel_id,
          originDockId: row.origin_dock_id,
          status: row.status as DepartureStatus,
        };
      },

      cancelDepartureForIncident: async (
        tx: unknown,
        params: {
          departureId: string;
          fromStatus: DepartureStatus;
          cancelReason: string;
        },
      ): Promise<void> => {
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
            "El estado de la salida cambió de forma concurrente al registrar el incidente.",
          );
        }
      },

      listBoardingsForIncident: async (
        tx: unknown,
        departureId: string,
      ): Promise<IncidentBoardingItem[]> => {
        const client = asTx(tx, this.prisma);
        const rows = await client.boarding.findMany({
          where: { departureId },
          orderBy: { seatNumber: "asc" },
        });
        const saleIds = Array.from(new Set(rows.map((b) => b.saleId)));
        const passengerIds = Array.from(
          new Set(rows.map((b) => b.passengerId).filter((id): id is string => Boolean(id))),
        );

        const [sales, passengers] = await Promise.all([
          saleIds.length > 0
            ? client.sale.findMany({
                where: { id: { in: saleIds } },
                select: { id: true, channel: true },
              })
            : Promise.resolve([]),
          passengerIds.length > 0
            ? client.user.findMany({
                where: { id: { in: passengerIds } },
                select: { id: true, fullName: true },
              })
            : Promise.resolve([]),
        ]);

        const channelMap = new Map(sales.map((s) => [s.id, s.channel]));
        const nameMap = new Map(passengers.map((p) => [p.id, p.fullName]));

        return rows.map((b) => ({
          id: b.id,
          departureId: b.departureId,
          saleId: b.saleId,
          saleChannel: channelMap.get(b.saleId) === "QR_BALANCE" ? "QR_BALANCE" : "TICKET_OFFICE",
          passengerId: b.passengerId,
          passengerName: b.passengerId ? (nameMap.get(b.passengerId) ?? null) : null,
          seatNumber: b.seatNumber,
          amountCharged: b.amountCharged.toString(),
          status: b.status as IncidentBoardingItem["status"],
        }));
      },

      markBoardingReassigned: async (
        tx: unknown,
        params: { boardingId: string },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.boarding.update({
          where: { id: params.boardingId },
          data: { status: "REASSIGNED" },
        });
      },

      markBoardingCancelledByIncident: async (
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

      enqueuePriorityWaitlist: async (
        tx: unknown,
        params: {
          dockId: string;
          passengerId: string | null;
          label: string | null;
          priority: number;
          originBoardingId: string;
          createdById: string;
        },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.waitlistEntry.create({
          data: {
            dockId: params.dockId,
            passengerId: params.passengerId,
            label: params.label,
            status: "WAITING",
            priority: params.priority,
            originBoardingId: params.originBoardingId,
            createdById: params.createdById,
          },
        });
      },

      creditWalletRefund: async (
        tx: unknown,
        params: {
          passengerId: string;
          saleId: string;
          amountPesos: string;
          reason: string;
          performedById: string;
        },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        const wallet = await client.wallet.findUnique({
          where: { userId: params.passengerId },
        });
        if (!wallet) {
          throw new DomainError(
            "WALLET_NOT_FOUND",
            "No se encontró el monedero del pasajero para reembolsar por incidente.",
          );
        }

        const currentBalance = Money.fromPesos(wallet.balance);
        const refundAmount = Money.fromPesos(params.amountPesos);
        const nextBalance = currentBalance.add(refundAmount);

        const updated = await client.wallet.updateMany({
          where: { id: wallet.id, version: wallet.version },
          data: {
            balance: nextBalance.toDecimalString(),
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          throw new DomainError(
            "WALLET_CONFLICT",
            "Conflicto de concurrencia al reembolsar por incidente.",
          );
        }

        await client.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: refundAmount.toDecimalString(),
            balanceAfter: nextBalance.toDecimalString(),
            saleId: params.saleId,
            performedById: params.performedById,
            reason: params.reason,
          },
        });
      },

      createNotification: async (
        tx: unknown,
        params: {
          userId: string;
          type: string;
          title: string;
          body: string;
        },
      ): Promise<void> => {
        const client = asTx(tx, this.prisma);
        await client.notification.create({
          data: {
            userId: params.userId,
            type: params.type,
            title: params.title,
            body: params.body,
          },
        });
      },
    };
  }

  async listServiceHoursByDock(dockId: string): Promise<ServiceHourWindow[]> {
    const rows = await this.prisma.serviceHour.findMany({
      where: { dockId },
      orderBy: { weekday: "asc" },
    });
    return rows.map((r) => ({
      weekday: r.weekday,
      opensAt: r.opensAt,
      closesAt: r.closesAt,
    }));
  }

  async listActiveOverridesByDock(dockId: string, now: Date): Promise<DockServiceOverrideRecord[]> {
    const rows = await this.prisma.dockServiceOverride.findMany({
      where: {
        dockId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      dockId: r.dockId,
      type: r.type as ServiceOverrideType,
      reason: r.reason,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      createdById: r.createdById,
    }));
  }

  async createOverride(input: CreateDockServiceOverrideInput): Promise<DockServiceOverrideRecord> {
    const created = await this.prisma.dockServiceOverride.create({
      data: {
        dockId: input.dockId,
        type: input.type,
        reason: input.reason,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdById: input.createdById,
      },
    });
    return {
      id: created.id,
      dockId: created.dockId,
      type: created.type as ServiceOverrideType,
      reason: created.reason,
      startsAt: created.startsAt,
      endsAt: created.endsAt,
      createdById: created.createdById,
    };
  }

  async closeActiveOverrides(params: {
    dockId: string;
    type: ServiceOverrideType;
    endedAt: Date;
  }): Promise<number> {
    const res = await this.prisma.dockServiceOverride.updateMany({
      where: {
        dockId: params.dockId,
        type: params.type,
        startsAt: { lte: params.endedAt },
        OR: [{ endsAt: null }, { endsAt: { gt: params.endedAt } }],
      },
      data: {
        endsAt: params.endedAt,
      },
    });
    return res.count;
  }

  async getMaxBoardingMinutes(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: "max_boarding_minutes" },
    });
    if (!setting) return DEFAULT_MAX_BOARDING_MINUTES;
    return parseMaxBoardingMinutesValue(setting.value);
  }

  async vesselExists(vesselId: string): Promise<boolean> {
    const row = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { id: true },
    });
    return Boolean(row);
  }

  async findDepartureSnapshot(departureId: string): Promise<IncidentDepartureSnapshot | null> {
    const row = await this.prisma.departure.findUnique({
      where: { id: departureId },
      select: {
        id: true,
        vesselId: true,
        originDockId: true,
        status: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      vesselId: row.vesselId,
      originDockId: row.originDockId,
      status: row.status as DepartureStatus,
    };
  }

  async listRecentIncidentsByDock(dockId: string, limit = 10): Promise<IncidentRecord[]> {
    const rows = await this.prisma.incident.findMany({
      where: {
        departure: {
          originDockId: dockId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      vesselId: r.vesselId,
      departureId: r.departureId,
      type: r.type,
      description: r.description,
      action: r.action as IncidentActionType,
      reportedById: r.reportedById,
      createdAt: r.createdAt,
    }));
  }
}
