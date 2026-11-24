import type {
  CurrentFareRow,
  DocksLiveSnapshot,
  DockServiceHourRow,
  PaginatedTripsResult,
  PassengerInfoRepository,
} from "@/application/passenger-info/ports";
import { Money } from "@/domain/shared/money";
import { prisma } from "@/infrastructure/db/prisma";

const DEFAULT_CROSSING_MINUTES = 10;

export class PrismaPassengerInfoRepository implements PassengerInfoRepository {
  async getDocksLiveSnapshot(): Promise<DocksLiveSnapshot> {
    const [docks, boardingRows, inboundRows, crossingSetting] = await Promise.all([
      prisma.dock.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { code: "asc" },
      }),
      prisma.departure.findMany({
        where: {
          status: { in: ["BOARDING", "BOARDING_CLOSED"] },
          vessel: { status: "ACTIVE" },
        },
        select: {
          id: true,
          originDockId: true,
          status: true,
          passengerCapacity: true,
          occupiedSeats: true,
          boardingStartedAt: true,
          vessel: {
            select: {
              name: true,
              kind: true,
              color: true,
              photoUrl: true,
            },
          },
          driver: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: [{ boardingStartedAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.departure.findMany({
        where: {
          status: "IN_TRANSIT",
          vessel: { status: "ACTIVE" },
        },
        select: {
          id: true,
          destinationDockId: true,
          departedAt: true,
          originDock: {
            select: {
              name: true,
            },
          },
          vessel: {
            select: {
              name: true,
              kind: true,
              color: true,
              photoUrl: true,
            },
          },
        },
        orderBy: [{ departedAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.systemSetting.findUnique({
        where: { key: "crossing_minutes" },
        select: { value: true },
      }),
    ]);

    const rawMinutes = Number(crossingSetting?.value);
    const crossingMinutes =
      Number.isFinite(rawMinutes) && rawMinutes > 0
        ? Math.round(rawMinutes)
        : DEFAULT_CROSSING_MINUTES;

    return {
      docks,
      boardingDepartures: boardingRows.map((row) => ({
        id: row.id,
        originDockId: row.originDockId,
        status: row.status === "BOARDING_CLOSED" ? "BOARDING_CLOSED" : "BOARDING",
        vesselName: row.vessel.name,
        vesselKind: row.vessel.kind,
        vesselColor: row.vessel.color,
        vesselPhotoUrl: row.vessel.photoUrl,
        passengerCapacity: row.passengerCapacity,
        occupiedSeats: row.occupiedSeats,
        boardingStartedAt: row.boardingStartedAt,
        driverName: row.driver?.fullName ?? null,
      })),
      inboundDepartures: inboundRows.map((row) => ({
        id: row.id,
        destinationDockId: row.destinationDockId,
        originDockName: row.originDock.name,
        vesselName: row.vessel.name,
        vesselKind: row.vessel.kind,
        vesselColor: row.vessel.color,
        vesselPhotoUrl: row.vessel.photoUrl,
        departedAt: row.departedAt,
      })),
      crossingMinutes,
    };
  }

  async getServiceHours(): Promise<DockServiceHourRow[]> {
    const rows = await prisma.serviceHour.findMany({
      select: {
        dockId: true,
        weekday: true,
        opensAt: true,
        closesAt: true,
        dock: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ dock: { code: "asc" } }, { weekday: "asc" }],
    });

    return rows.map((row) => ({
      dockId: row.dockId,
      dockCode: row.dock.code,
      dockName: row.dock.name,
      weekday: row.weekday,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
    }));
  }

  async getCurrentFares(at: Date): Promise<CurrentFareRow[]> {
    const rows = await prisma.fare.findMany({
      where: {
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
      select: {
        id: true,
        vesselKind: true,
        category: true,
        vehicleTypeId: true,
        amount: true,
        vehicleType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ vesselKind: "asc" }, { category: "asc" }, { vehicleTypeId: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      vesselKind: row.vesselKind,
      category: row.category,
      vehicleTypeId: row.vehicleTypeId,
      vehicleTypeName: row.vehicleType?.name ?? null,
      amountCents: Money.fromPesos(row.amount).cents,
    }));
  }

  async listPassengerTrips(
    passengerId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedTripsResult> {
    const skip = (page - 1) * pageSize;

    const [totalItems, rows] = await Promise.all([
      prisma.boarding.count({
        where: { passengerId },
      }),
      prisma.boarding.findMany({
        where: { passengerId },
        select: {
          id: true,
          createdAt: true,
          seatNumber: true,
          fareCategory: true,
          amountCharged: true,
          status: true,
          departure: {
            select: {
              originDock: { select: { name: true } },
              destinationDock: { select: { name: true } },
              vessel: { select: { name: true, kind: true } },
            },
          },
          vehicle: {
            select: { plate: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      totalItems,
      rows: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        originDockName: row.departure.originDock.name,
        destinationDockName: row.departure.destinationDock.name,
        vesselName: row.departure.vessel.name,
        vesselKind: row.departure.vessel.kind,
        seatNumber: row.seatNumber,
        fareCategory: row.fareCategory,
        vehiclePlate: row.vehicle?.plate ?? null,
        amountChargedCents: Money.fromPesos(row.amountCharged).cents,
        status: row.status,
      })),
    };
  }
}
