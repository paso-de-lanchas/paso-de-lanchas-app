import { beforeEach, describe, expect, it } from "vitest";

import type { LockedBoardingCancellation } from "@/application/boarding/ports";
import { Money } from "@/domain/shared/money";

import { createCancelBoarding } from "./cancel-boarding";
import type { BoardingCancellationStore } from "./ports";

const BOARDING_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-27T18:00:00.000Z");
const ACTOR = { adminId: "admin-1", dockId: "dock-1", deviceId: "device-1" };

class MemoryCancellationStore implements BoardingCancellationStore<"tx"> {
  boarding: LockedBoardingCancellation = {
    boardingId: BOARDING_ID,
    departureId: "departure-1",
    departureStatus: "BOARDING",
    occupiedSeats: 2,
    passengerCapacity: 10,
    boardingStatus: "BOARDED",
    passengerId: "passenger-1",
    saleId: "sale-1",
    paymentMethod: "BALANCE",
    cashShiftId: null,
    seatNumber: 2,
    vehicleTypeId: null,
    amount: Money.fromPesos("12.50"),
    fareCategory: "GENERAL",
  };
  occupiedSeats = 2;
  cancelled = false;
  walletRefunds: number[] = [];
  cashRefunds: number[] = [];

  async run<T>(work: (tx: "tx") => Promise<T>): Promise<T> {
    const snapshot = {
      boarding: { ...this.boarding },
      occupiedSeats: this.occupiedSeats,
      cancelled: this.cancelled,
      walletRefunds: [...this.walletRefunds],
      cashRefunds: [...this.cashRefunds],
    };
    try {
      return await work("tx");
    } catch (error) {
      this.boarding = snapshot.boarding;
      this.occupiedSeats = snapshot.occupiedSeats;
      this.cancelled = snapshot.cancelled;
      this.walletRefunds = snapshot.walletRefunds;
      this.cashRefunds = snapshot.cashRefunds;
      throw error;
    }
  }

  async lockBoardingForCancellation(_tx: "tx", _dockId: string, boardingId: string) {
    return boardingId === this.boarding.boardingId ? { ...this.boarding } : null;
  }

  async cancelBoarding(_tx: "tx", input: { boarding: LockedBoardingCancellation; reason: string }) {
    this.cancelled = true;
    this.boarding.boardingStatus = "CANCELLED";
    this.occupiedSeats -= 1;
    if (input.boarding.paymentMethod === "BALANCE") {
      this.walletRefunds.push(input.boarding.amount.cents);
    } else {
      this.cashRefunds.push(input.boarding.amount.cents);
    }
  }
}

let store: MemoryCancellationStore;
let cancel: ReturnType<typeof createCancelBoarding<"tx">>;

function setup() {
  store = new MemoryCancellationStore();
  cancel = createCancelBoarding({ store, clock: { now: () => NOW } });
}

describe("cancelar abordaje", () => {
  beforeEach(setup);

  it("marca cancelado, libera el lugar y devuelve exactamente el pago al saldo", async () => {
    const result = await cancel({ boardingId: BOARDING_ID, reason: "Error de captura" }, ACTOR);

    expect(result).toMatchObject({
      seatNumber: 2,
      amountCents: 1250,
      paymentMethod: "BALANCE",
      reason: "Error de captura",
    });
    expect(store.cancelled).toBe(true);
    expect(store.occupiedSeats).toBe(1);
    expect(store.walletRefunds).toEqual([1250]);
    expect(store.cashRefunds).toEqual([]);
  });

  it("registra una devolución en efectivo contra el turno asociado", async () => {
    store.boarding.paymentMethod = "CASH";
    store.boarding.cashShiftId = "cash-shift-1";

    await cancel({ boardingId: BOARDING_ID, reason: "Venta duplicada" }, ACTOR);

    expect(store.cashRefunds).toEqual([1250]);
    expect(store.walletRefunds).toEqual([]);
    expect(store.occupiedSeats).toBe(1);
  });

  it("no cancela ni reembolsa si el viaje ya inició", async () => {
    store.boarding.departureStatus = "IN_TRANSIT";

    await expect(cancel({ boardingId: BOARDING_ID, reason: "Error" }, ACTOR)).rejects.toThrow(
      "No se puede cancelar un abordaje",
    );

    expect(store.cancelled).toBe(false);
    expect(store.occupiedSeats).toBe(2);
    expect(store.walletRefunds).toEqual([]);
  });

  it("exige un motivo no vacío", async () => {
    await expect(cancel({ boardingId: BOARDING_ID, reason: "   " }, ACTOR)).rejects.toMatchObject({
      fieldErrors: { reason: "Escribe el motivo de la cancelación." },
    });
    expect(store.cancelled).toBe(false);
  });

  it("una segunda solicitud no repite la devolución", async () => {
    await cancel({ boardingId: BOARDING_ID, reason: "Error" }, ACTOR);

    await expect(cancel({ boardingId: BOARDING_ID, reason: "Otra vez" }, ACTOR)).rejects.toThrow(
      "ya fue cancelado",
    );

    expect(store.walletRefunds).toEqual([1250]);
    expect(store.occupiedSeats).toBe(1);
  });
});
