import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { createCancelDeparture } from "./cancel-departure";
import { createReturnDeparture } from "./create-return-departure";
import type { DepartureRecord, DepartureRepository } from "./ports";

function makeDeparture(overrides: Partial<DepartureRecord> = {}): DepartureRecord {
  return {
    id: "dep-1",
    vesselId: "ves-1",
    driverId: "drv-1",
    originDockId: "dock-coa",
    destinationDockId: "dock-val",
    status: "BOARDING",
    queuePosition: null,
    passengerCapacity: 40,
    occupiedSeats: 2,
    returnOfId: null,
    cancelReason: null,
    boardingStartedAt: new Date("2026-11-24T10:00:00.000Z"),
    boardingClosedAt: null,
    createdAt: new Date("2026-11-24T09:50:00.000Z"),
    vehicleCapacities: [{ vehicleTypeId: 1, capacity: 5, occupied: 0 }],
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DepartureRepository> = {}): DepartureRepository {
  const baseDeparture = makeDeparture();
  const queuedNext = makeDeparture({
    id: "dep-queued-2",
    vesselId: "ves-2",
    status: "QUEUED",
    queuePosition: 1,
  });

  const recordCashRefund = vi.fn().mockResolvedValue(undefined);
  const creditWalletRefund = vi.fn().mockResolvedValue(undefined);
  const createNotification = vi.fn().mockResolvedValue(undefined);
  const markBoardingCancelled = vi.fn().mockResolvedValue(undefined);

  const unitOfWork: DepartureRepository["unitOfWork"] = {
    run: async (work) => work({}),
    lockDepartureForUpdate: vi.fn().mockResolvedValue(baseDeparture),
    markDepartureCancelled: vi.fn().mockResolvedValue({
      ...baseDeparture,
      status: "CANCELLED",
      cancelReason: "Falla mecánica",
    }),
    listBoardingsForDeparture: vi.fn().mockResolvedValue([
      {
        id: "brd-1",
        departureId: "dep-1",
        saleId: "sale-1",
        saleChannel: "QR_BALANCE",
        passengerId: "user-1",
        seatNumber: 1,
        amountCharged: "7.00",
        status: "BOARDED",
      },
      {
        id: "brd-2",
        departureId: "dep-1",
        saleId: "sale-2",
        saleChannel: "TICKET_OFFICE",
        passengerId: null,
        seatNumber: 2,
        amountCharged: "7.00",
        status: "BOARDED",
      },
    ]),
    markBoardingCancelled,
    creditWalletRefund,
    recordCashRefund,
    createNotification,
    markDepartureFinished: vi.fn().mockResolvedValue({
      ...baseDeparture,
      status: "IN_TRANSIT",
    }),
    createReturnQueuedDeparture: vi.fn().mockResolvedValue(
      makeDeparture({
        id: "dep-return-1",
        originDockId: "dock-val",
        destinationDockId: "dock-coa",
        status: "QUEUED",
        queuePosition: 1,
        returnOfId: "dep-1",
        occupiedSeats: 0,
      }),
    ),
  };

  return {
    findDockById: vi.fn().mockResolvedValue({ id: "dock-coa", code: "COA", name: "Coatzacoalcos" }),
    listDocks: vi.fn().mockResolvedValue([]),
    findEligibleVessel: vi.fn().mockResolvedValue(null),
    listEligibleVessels: vi.fn().mockResolvedValue([]),
    listDeparturesByDock: vi.fn().mockResolvedValue([queuedNext]),
    findDepartureById: vi.fn().mockResolvedValue(baseDeparture),
    findActiveBoardingByDock: vi.fn().mockResolvedValue(null),
    createDeparture: vi.fn(),
    updateDepartureStatus: vi.fn().mockResolvedValue({
      ...queuedNext,
      status: "BOARDING",
      queuePosition: null,
    }),
    applyQueuePositions: vi.fn().mockResolvedValue(undefined),
    listWaitlistByDock: vi.fn().mockResolvedValue([]),
    createWaitlistEntry: vi.fn(),
    findBoardingForUpdate: vi.fn().mockResolvedValue(null),
    occupySeat: vi.fn().mockResolvedValue(1),
    unitOfWork,
    ...overrides,
  };
}

describe("cancelDeparture y createReturnDeparture (#46)", () => {
  const clock = { now: () => new Date("2026-11-24T10:15:00.000Z") };

  it("cancela salida BOARDING, reembolsa monedero, registra efectivo y pasa siguiente a BOARDING", async () => {
    const repo = makeRepo();
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const cancelDeparture = createCancelDeparture(repo, clock, audit);

    const res = await cancelDeparture({
      departureId: "dep-1",
      cancelReason: "Falla mecánica",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(res.departure.status).toBe("CANCELLED");
    expect(res.cancelledBoardingsCount).toBe(2);
    expect(res.refundedBalanceCount).toBe(1);
    expect(res.totalRefundedBalance).toBe("7.00");
    expect(res.cashRefundsReady).toEqual([
      { boardingId: "brd-2", saleId: "sale-2", seatNumber: 2, amount: "7.00" },
    ]);
    expect(repo.unitOfWork.recordCashRefund).toHaveBeenCalledTimes(1);
    expect(res.nextBoarding?.id).toBe("dep-queued-2");
    expect(res.nextBoarding?.status).toBe("BOARDING");
  });

  it("exige motivo obligatorio al cancelar", async () => {
    const repo = makeRepo();
    const cancelDeparture = createCancelDeparture(repo, clock);

    await expect(
      cancelDeparture({
        departureId: "dep-1",
        cancelReason: "   ",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("crea salida de retorno en cola dentro de unitOfWork", async () => {
    const repo = makeRepo({
      findDepartureById: vi.fn().mockResolvedValue(
        makeDeparture({
          status: "IN_TRANSIT",
          occupiedSeats: 12,
        }),
      ),
    });
    const returnDeparture = createReturnDeparture(repo, clock);

    const res = await returnDeparture({
      departureId: "dep-1",
      actorUserId: "admin-1",
      actorDockId: "dock-val",
    });

    expect(repo.unitOfWork.markDepartureFinished).toHaveBeenCalledTimes(1);
    expect(repo.unitOfWork.createReturnQueuedDeparture).toHaveBeenCalledTimes(1);
    expect(res.returnDeparture.originDockId).toBe("dock-val");
    expect(res.returnDeparture.destinationDockId).toBe("dock-coa");
    expect(res.returnDeparture.status).toBe("QUEUED");
  });
});
