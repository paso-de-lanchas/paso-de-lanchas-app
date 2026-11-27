import { beforeEach, describe, expect, it } from "vitest";

import type { FareOption } from "@/domain/fares/fare-strategy";
import { Money } from "@/domain/shared/money";

import { createSellTickets } from "./sell-tickets";
import type {
  CreatedTicketOfficeSale,
  LockedDeparture,
  TicketOfficeSaleAudit,
  TicketOfficeStore,
  TicketOfficeTicketData,
} from "./ports";

const NOW = new Date("2026-11-27T18:00:00.000Z");
const ACTOR = { adminId: "admin-1", dockId: "dock-1", deviceId: "device-1" };
const GENERAL_FARE_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_FARE_ID = "22222222-2222-4222-8222-222222222222";
const VEHICLE_FARE_ID = "33333333-3333-4333-8333-333333333333";

function fare(overrides: Partial<FareOption> = {}): FareOption {
  return {
    id: GENERAL_FARE_ID,
    vesselKind: "BOAT",
    category: "GENERAL",
    vehicleTypeId: null,
    amount: Money.fromPesos("10.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
    ...overrides,
  };
}

class MemoryTicketOfficeStore implements TicketOfficeStore<"tx"> {
  departure: (LockedDeparture & { dockId: string }) | null = {
    id: "departure-1",
    dockId: "dock-1",
    status: "BOARDING",
    vesselKind: "BOAT",
    vesselName: "Lancha 1",
    destinationDockName: "Villa Allende",
    passengerCapacity: 4,
    occupiedSeats: 0,
    highestSeat: null,
  };
  maxTickets = 5;
  fares: FareOption[] = [
    fare(),
    fare({ id: STUDENT_FARE_ID, category: "STUDENT", amount: Money.fromPesos("5.00") }),
  ];
  vehicleSpaces = new Map<number, { capacity: number; occupied: number }>();
  sales: Array<{ tickets: TicketOfficeTicketData[]; total: Money; audit: TicketOfficeSaleAudit }> =
    [];

  async run<T>(work: (tx: "tx") => Promise<T>): Promise<T> {
    const original = {
      departure: this.departure ? { ...this.departure } : null,
      sales: [...this.sales],
      vehicleSpaces: new Map([...this.vehicleSpaces].map(([key, value]) => [key, { ...value }])),
    };
    try {
      return await work("tx");
    } catch (error) {
      this.departure = original.departure;
      this.sales = original.sales;
      this.vehicleSpaces = original.vehicleSpaces;
      throw error;
    }
  }

  async lockBoardingDeparture(_tx: "tx", dockId: string) {
    return this.departure?.dockId === dockId ? { ...this.departure } : null;
  }

  async listFares() {
    return this.fares;
  }

  async getVehicleSpace(_tx: "tx", _departureId: string, vehicleTypeId: number) {
    return this.vehicleSpaces.get(vehicleTypeId) ?? null;
  }

  async occupySeat(_tx: "tx", input: { vehicleTypeId: number | null; closeWhenFull: boolean }) {
    this.departure!.occupiedSeats += 1;
    this.departure!.highestSeat = (this.departure!.highestSeat ?? 0) + 1;
    if (input.vehicleTypeId !== null) {
      this.vehicleSpaces.get(input.vehicleTypeId)!.occupied += 1;
    }
    if (input.closeWhenFull) this.departure!.status = "BOARDING_CLOSED";
    return { departureClosed: input.closeWhenFull, nextDepartureId: null };
  }

  async getMaxTicketsPerSale() {
    return this.maxTickets;
  }

  async ensureOpenCashShift() {
    return "cash-shift-1";
  }

  async createTicketOfficeSale(
    _tx: "tx",
    input: {
      tickets: TicketOfficeTicketData[];
      total: Money;
    },
    audit: TicketOfficeSaleAudit,
  ): Promise<CreatedTicketOfficeSale> {
    this.sales.push({ tickets: input.tickets, total: input.total, audit });
    return {
      saleId: `sale-${this.sales.length}`,
      tickets: input.tickets.map((ticket, index) => ({
        boardingId: `boarding-${index + 1}`,
        seatNumber: ticket.seatNumber,
        ticketCode: ticket.ticketCode,
        amount: ticket.amount,
      })),
    };
  }
}

let store: MemoryTicketOfficeStore;
let nextCode: number;
let sell: ReturnType<typeof createSellTickets<"tx">>;

function setup() {
  store = new MemoryTicketOfficeStore();
  nextCode = 0;
  sell = createSellTickets({
    store,
    clock: { now: () => NOW },
    ticketCodes: { generate: () => String.fromCharCode(65 + nextCode++).repeat(12) },
  });
}

describe("venta de boletos en taquilla", () => {
  beforeEach(setup);

  it("cobra en una venta y asigna lugares consecutivos con su código", async () => {
    const result = await sell(
      { tickets: [{ fareId: GENERAL_FARE_ID }, { fareId: STUDENT_FARE_ID }] },
      ACTOR,
    );

    expect(result).toMatchObject({
      totalCents: 1500,
      departureClosed: false,
      tickets: [
        { seatNumber: 1, fareCategory: "GENERAL", amountCents: 1000 },
        { seatNumber: 2, fareCategory: "STUDENT", amountCents: 500 },
      ],
    });
    expect(result.tickets.map((ticket) => ticket.ticketCode)).toEqual([
      "AAAAAAAAAAAA",
      "BBBBBBBBBBBB",
    ]);
    expect(store.sales).toHaveLength(1);
    expect(store.sales[0].audit.action).toBe("TICKET_OFFICE_SALE");
    expect(store.departure?.occupiedSeats).toBe(2);
  });

  it("no registra ninguno si la cantidad supera los lugares disponibles", async () => {
    store.departure!.passengerCapacity = 3;
    store.departure!.occupiedSeats = 2;

    await expect(
      sell({ tickets: [{ fareId: GENERAL_FARE_ID }, { fareId: STUDENT_FARE_ID }] }, ACTOR),
    ).rejects.toThrow("No hay suficientes lugares disponibles");

    expect(store.sales).toHaveLength(0);
    expect(store.departure?.occupiedSeats).toBe(2);
  });

  it("respeta el máximo configurado por venta", async () => {
    store.maxTickets = 1;

    await expect(
      sell({ tickets: [{ fareId: GENERAL_FARE_ID }, { fareId: STUDENT_FARE_ID }] }, ACTOR),
    ).rejects.toThrow("Puedes vender como máximo 1 boletos");
    expect(store.sales).toHaveLength(0);
  });

  it("no vende vehículos si el lote excede el cupo de ese tipo", async () => {
    store.departure!.vesselKind = "FERRY";
    store.fares = [
      fare({
        id: VEHICLE_FARE_ID,
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: 1,
      }),
    ];
    store.vehicleSpaces.set(1, { capacity: 1, occupied: 0 });

    await expect(
      sell(
        {
          tickets: [{ fareId: VEHICLE_FARE_ID }, { fareId: VEHICLE_FARE_ID }],
        },
        ACTOR,
      ),
    ).rejects.toThrow("No hay espacio suficiente para todos los vehículos");
    expect(store.sales).toHaveLength(0);
    expect(store.departure?.occupiedSeats).toBe(0);
  });

  it("rechaza una tarifa seleccionada que no corresponde a la embarcación", async () => {
    store.fares.push(
      fare({
        id: VEHICLE_FARE_ID,
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: 1,
      }),
    );
    await expect(sell({ tickets: [{ fareId: VEHICLE_FARE_ID }] }, ACTOR)).rejects.toThrow(
      "ya no está vigente",
    );
    expect(store.sales).toHaveLength(0);
  });
});
