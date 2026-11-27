import { z } from "zod";

import { parseInput } from "@/application/shared/input-error";
import { systemClock, type Clock } from "@/application/shared/ports";
import { BoardingError, nextSeatNumber } from "@/domain/boarding/boarding";
import { resolveTicketOfficeFare } from "@/domain/boarding/ticket-office";
import type { FareCategory } from "@/domain/fares/fare";
import { Money } from "@/domain/shared/money";
import { DomainError } from "@/domain/shared/domain-error";
import { retryConcurrentUpdate } from "@/application/wallet/retry-concurrent-update";

import type { TicketOfficeStore } from "./ports";

const ticketSelectionSchema = z.object({
  fareId: z.string().uuid(),
});

export const sellTicketsSchema = z.object({
  tickets: z.array(ticketSelectionSchema).min(1, "Agrega al menos un boleto."),
});

export interface TicketOfficeActor {
  adminId: string;
  dockId: string | null;
  deviceId: string | null;
}

export interface TicketCodeGenerator {
  generate(): string;
}

export function createSellTickets<Tx>(deps: {
  store: TicketOfficeStore<Tx>;
  ticketCodes: TicketCodeGenerator;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function sellTickets(rawInput: unknown, actor: TicketOfficeActor) {
    const dockId = actor.dockId;
    const deviceId = actor.deviceId;
    if (!dockId) {
      throw new BoardingError("NO_DOCK_ASSIGNED", "Tu cuenta no tiene un muelle asignado.");
    }
    if (!deviceId) {
      throw new BoardingError(
        "AUTHORIZED_DEVICE_REQUIRED",
        "Registra la venta desde una computadora autorizada del muelle.",
      );
    }

    const input = parseInput<"tickets", typeof sellTicketsSchema>(sellTicketsSchema, rawInput);
    const at = clock.now();

    return retryConcurrentUpdate(() =>
      deps.store.run(async (tx) => {
        const departure = await deps.store.lockBoardingDeparture(tx, dockId);
        const maxTickets = await deps.store.getMaxTicketsPerSale(tx);
        if (!Number.isSafeInteger(maxTickets) || maxTickets < 1) {
          throw new DomainError(
            "INVALID_TICKET_SALE_LIMIT",
            "La configuración del máximo de boletos por venta no es válida.",
          );
        }
        if (input.tickets.length > maxTickets) {
          throw new DomainError(
            "TICKET_SALE_LIMIT_EXCEEDED",
            `Puedes vender como máximo ${maxTickets} boletos por operación.`,
          );
        }
        if (!departure) {
          throw new BoardingError(
            "NO_DEPARTURE_BOARDING",
            "No hay ninguna embarcación abordando en este muelle.",
          );
        }
        if (departure.occupiedSeats + input.tickets.length > departure.passengerCapacity) {
          throw new BoardingError(
            "DEPARTURE_FULL",
            "No hay suficientes lugares disponibles para vender todos los boletos.",
            { available: departure.passengerCapacity - departure.occupiedSeats },
          );
        }

        const fares = await deps.store.listFares(tx, departure.vesselKind, at);
        const reservedVehicleSpaces = new Map<number, number>();
        const resolved: Array<{
          fareId: string;
          category: FareCategory;
          vehicleTypeId: number | null;
          amount: Money;
          seatNumber: number;
          ticketCode: string;
        }> = [];
        for (let index = 0; index < input.tickets.length; index += 1) {
          const selection = input.tickets[index];
          const fare = resolveTicketOfficeFare(selection.fareId, departure.vesselKind, fares, at);
          if (fare.vehicleTypeId !== null) {
            const space = await deps.store.getVehicleSpace(tx, departure.id, fare.vehicleTypeId);
            const reserved = reservedVehicleSpaces.get(fare.vehicleTypeId) ?? 0;
            if (!space || space.occupied + reserved >= space.capacity) {
              throw new BoardingError(
                "VEHICLE_SPACE_FULL",
                "No hay espacio suficiente para todos los vehículos de esta venta.",
              );
            }
            reservedVehicleSpaces.set(fare.vehicleTypeId, reserved + 1);
          }
          resolved.push({
            fareId: fare.fareId,
            category: fare.category,
            vehicleTypeId: fare.vehicleTypeId,
            amount: fare.amount,
            seatNumber: nextSeatNumber(departure.highestSeat) + index,
            ticketCode: deps.ticketCodes.generate(),
          });
        }

        const total = resolved.reduce((sum, ticket) => sum.add(ticket.amount), Money.zero());
        if (total.cents > 9_999_999_999) {
          throw new DomainError(
            "INVALID_TICKET_SALE_TOTAL",
            "El total de la venta supera el máximo permitido.",
          );
        }
        const cashShiftId = await deps.store.ensureOpenCashShift(tx, {
          adminId: actor.adminId,
          deviceId,
          at,
        });
        const sale = await deps.store.createTicketOfficeSale(
          tx,
          {
            departureId: departure.id,
            registeredById: actor.adminId,
            deviceId,
            cashShiftId,
            tickets: resolved,
            total,
            at,
          },
          {
            userId: actor.adminId,
            deviceId,
            action: "TICKET_OFFICE_SALE",
            details: {
              departureId: departure.id,
              dockId,
              cashShiftId,
              ticketCount: resolved.length,
              totalCents: total.cents,
              tickets: resolved.map(({ seatNumber, ticketCode, category, amount }) => ({
                seatNumber,
                ticketCode,
                fareCategory: category,
                amountCents: amount.cents,
              })),
            },
          },
        );

        for (let index = 0; index < resolved.length; index += 1) {
          await deps.store.occupySeat(tx, {
            departureId: departure.id,
            vehicleTypeId: resolved[index].vehicleTypeId,
            closeWhenFull: departure.occupiedSeats + index + 1 >= departure.passengerCapacity,
            at,
          });
        }

        return {
          saleId: sale.saleId,
          departureId: departure.id,
          vesselName: departure.vesselName,
          destinationDockName: departure.destinationDockName,
          totalCents: total.cents,
          tickets: sale.tickets.map((ticket, index) => ({
            boardingId: ticket.boardingId,
            seatNumber: ticket.seatNumber,
            ticketCode: ticket.ticketCode,
            fareCategory: resolved[index].category,
            amountCents: ticket.amount.cents,
          })),
          departureClosed: departure.occupiedSeats + resolved.length >= departure.passengerCapacity,
        };
      }),
    );
  };
}
