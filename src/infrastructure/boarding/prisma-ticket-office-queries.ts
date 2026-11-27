import type { TicketOfficeQueries } from "@/application/boarding/ticket-office-queries";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

export function createPrismaTicketOfficeQueries(db: PrismaClient = prisma): TicketOfficeQueries {
  return {
    async findTicketOfficeDeparture(dockId, at) {
      const departure = await db.departure.findFirst({
        where: { originDockId: dockId, status: "BOARDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          passengerCapacity: true,
          occupiedSeats: true,
          vessel: { select: { name: true, kind: true } },
          destinationDock: { select: { name: true } },
        },
      });
      if (!departure) return null;

      const [fares, setting] = await Promise.all([
        db.fare.findMany({
          where: {
            vesselKind: departure.vessel.kind,
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gt: at } }],
          },
          include: { vehicleType: { select: { name: true } } },
          orderBy: [{ category: "asc" }, { vehicleTypeId: "asc" }],
        }),
        db.systemSetting.findUnique({
          where: { key: "max_tickets_per_sale" },
          select: { value: true },
        }),
      ]);
      if (
        typeof setting?.value !== "number" ||
        !Number.isSafeInteger(setting.value) ||
        setting.value < 1
      ) {
        throw new DomainError(
          "INVALID_TICKET_SALE_LIMIT",
          "La configuración max_tickets_per_sale no es válida.",
        );
      }

      return {
        id: departure.id,
        vesselName: departure.vessel.name,
        vesselKind: departure.vessel.kind,
        destinationDockName: departure.destinationDock.name,
        passengerCapacity: departure.passengerCapacity,
        occupiedSeats: departure.occupiedSeats,
        maxTicketsPerSale: setting.value,
        fares: fares.map((fare) => ({
          id: fare.id,
          category: fare.category,
          vehicleTypeId: fare.vehicleTypeId,
          vehicleTypeName: fare.vehicleType?.name ?? null,
          amountCents: Money.fromPesos(fare.amount).cents,
        })),
      };
    },

    async listCancellableBoardings(dockId) {
      const rows = await db.boarding.findMany({
        where: {
          status: "BOARDED",
          departure: {
            originDockId: dockId,
            status: { in: ["BOARDING", "BOARDING_CLOSED", "CANCELLED"] },
          },
        },
        orderBy: [{ departure: { createdAt: "asc" } }, { seatNumber: "asc" }],
        select: {
          id: true,
          seatNumber: true,
          ticketCode: true,
          fareCategory: true,
          amountCharged: true,
          sale: { select: { paymentMethod: true } },
          departure: {
            select: {
              status: true,
              vessel: { select: { name: true } },
              destinationDock: { select: { name: true } },
            },
          },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        seatNumber: row.seatNumber,
        ticketCode: row.ticketCode,
        fareCategory: row.fareCategory,
        amountCents: Money.fromPesos(row.amountCharged).cents,
        departureStatus: row.departure.status,
        vesselName: row.departure.vessel.name,
        destinationDockName: row.departure.destinationDock.name,
        paymentMethod: row.sale.paymentMethod,
      }));
    },
  };
}
