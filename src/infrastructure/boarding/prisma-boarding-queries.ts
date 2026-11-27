import type {
  BoardingQueries,
  DockBoardingSummary,
  PassengerBoardingView,
} from "@/application/boarding/boarding-queries";
import { Money } from "@/domain/shared/money";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

const ACTIVE_DEPARTURE = ["BOARDING", "BOARDING_CLOSED", "IN_TRANSIT"] as const;

export function createPrismaBoardingQueries(db: PrismaClient = prisma): BoardingQueries {
  return {
    async findDockBoarding(dockId): Promise<DockBoardingSummary | null> {
      const departure = await db.departure.findFirst({
        where: { originDockId: dockId, status: "BOARDING" },
        select: {
          id: true,
          passengerCapacity: true,
          occupiedSeats: true,
          vessel: { select: { name: true, kind: true } },
          destinationDock: { select: { name: true } },
          vehicleCapacity: {
            select: { capacity: true, occupied: true, vehicleType: { select: { name: true } } },
            orderBy: { vehicleTypeId: "asc" },
          },
        },
      });
      if (!departure) return null;
      return {
        departureId: departure.id,
        vesselName: departure.vessel.name,
        vesselKind: departure.vessel.kind,
        destinationDockName: departure.destinationDock.name,
        passengerCapacity: departure.passengerCapacity,
        occupiedSeats: departure.occupiedSeats,
        vehicleSpaces: departure.vehicleCapacity.map((v) => ({
          vehicleTypeName: v.vehicleType.name,
          capacity: v.capacity,
          occupied: v.occupied,
        })),
      };
    },

    async findCurrentPassengerBoarding(passengerId): Promise<PassengerBoardingView | null> {
      const boarding = await db.boarding.findFirst({
        where: {
          passengerId,
          status: "BOARDED",
          departure: { status: { in: [...ACTIVE_DEPARTURE] } },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          seatNumber: true,
          fareCategory: true,
          amountCharged: true,
          createdAt: true,
          vehicle: { select: { plate: true } },
          departure: {
            select: {
              status: true,
              vessel: { select: { name: true, kind: true } },
              originDock: { select: { name: true } },
              destinationDock: { select: { name: true } },
            },
          },
        },
      });
      if (!boarding) return null;
      return {
        boardingId: boarding.id,
        seatNumber: boarding.seatNumber,
        vesselName: boarding.departure.vessel.name,
        vesselKind: boarding.departure.vessel.kind,
        originDockName: boarding.departure.originDock.name,
        destinationDockName: boarding.departure.destinationDock.name,
        fareCategory: boarding.fareCategory,
        amountCents: Money.fromPesos(boarding.amountCharged).cents,
        departureStatus: boarding.departure.status as PassengerBoardingView["departureStatus"],
        boardedAt: boarding.createdAt.toISOString(),
        vehiclePlate: boarding.vehicle?.plate ?? null,
      };
    },
  };
}
