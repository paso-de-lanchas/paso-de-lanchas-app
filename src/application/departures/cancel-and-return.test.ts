import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import type { Clock } from "@/application/shared/ports";
import { createCancelDeparture } from "./cancel-departure";
import { createFinishTrip, createReturnDeparture } from "./create-return-departure";
import { createListDepartureBoardings } from "./list-departure-boardings";
import type {
  DepartureBoardingForCancel,
  DepartureBoardingItem,
  DepartureRecord,
  DepartureRepository,
  DepartureUnitOfWork,
} from "./ports";

const fixedClock: Clock = {
  now: () => new Date("2026-11-24T00:15:00.000Z"),
};

function makeDeparture(overrides: Partial<DepartureRecord> & { id: string }): DepartureRecord {
  return {
    id: overrides.id,
    vesselId: overrides.vesselId ?? "vessel-1",
    driverId: overrides.driverId ?? "driver-1",
    originDockId: overrides.originDockId ?? "dock-coa",
    destinationDockId: overrides.destinationDockId ?? "dock-val",
    status: overrides.status ?? "BOARDING",
    queuePosition: overrides.queuePosition ?? null,
    passengerCapacity: overrides.passengerCapacity ?? 120,
    occupiedSeats: overrides.occupiedSeats ?? 0,
    returnOfId: overrides.returnOfId ?? null,
    cancelReason: overrides.cancelReason ?? null,
    boardingStartedAt: overrides.boardingStartedAt ?? fixedClock.now(),
    boardingClosedAt: overrides.boardingClosedAt ?? null,
    createdAt: overrides.createdAt ?? fixedClock.now(),
    vehicleCapacities: overrides.vehicleCapacities ?? [
      { vehicleTypeId: 1, capacity: 10, occupied: 0 },
    ],
  };
}

function buildTestRepo(params: {
  departures: DepartureRecord[];
  boardingsForCancel?: DepartureBoardingForCancel[];
  withUnitOfWork?: boolean;
  withListBoardings?: boolean;
}): {
  repo: DepartureRepository;
  creditWalletRefund: ReturnType<typeof vi.fn>;
  markBoardingCancelled: ReturnType<typeof vi.fn>;
  createNotification: ReturnType<typeof vi.fn>;
  createReturnQueuedDeparture: ReturnType<typeof vi.fn>;
  findBoardingForUpdate: ReturnType<typeof vi.fn>;
} {
  const departures = [...params.departures];
  const boardingsForCancel = [...(params.boardingsForCancel ?? [])];

  const lockDepartureForUpdate = vi.fn(
    async (_tx: unknown, departureId: string) =>
      departures.find((d) => d.id === departureId) ?? null,
  );

  const markDepartureCancelled = vi.fn(
    async (
      _tx: unknown,
      upd: {
        departureId: string;
        fromStatus: DepartureRecord["status"];
        cancelReason: string;
      },
    ) => {
      const idx = departures.findIndex((d) => d.id === upd.departureId);
      const updated = makeDeparture({
        ...departures[idx],
        status: "CANCELLED",
        queuePosition: null,
        cancelReason: upd.cancelReason,
      });
      departures[idx] = updated;
      return updated;
    },
  );

  const listBoardingsForDeparture = vi.fn(async (_tx: unknown, departureId: string) =>
    boardingsForCancel.filter((b) => b.departureId === departureId),
  );

  const markBoardingCancelled = vi.fn(async () => undefined);
  const creditWalletRefund = vi.fn(async () => undefined);
  const createNotification = vi.fn(async () => undefined);
  const findBoardingForUpdate = vi.fn(async () => null);

  const markDepartureFinished = vi.fn(
    async (_tx: unknown, fin: { departureId: string; finishedAt: Date; actorUserId: string }) => {
      const idx = departures.findIndex((d) => d.id === fin.departureId);
      const updated = makeDeparture({
        ...departures[idx],
        status: "FINISHED",
        queuePosition: null,
      });
      departures[idx] = updated;
      return updated;
    },
  );

  const createReturnQueuedDeparture = vi.fn(async (_tx: unknown, data) => {
    const created = makeDeparture({
      id: "dep-return-1",
      vesselId: data.vesselId,
      driverId: data.driverId,
      originDockId: data.originDockId,
      destinationDockId: data.destinationDockId,
      status: data.status,
      queuePosition: data.queuePosition,
      passengerCapacity: data.passengerCapacity,
      returnOfId: data.returnOfId ?? null,
      boardingStartedAt: null,
      vehicleCapacities: data.vehicleCapacities.map(
        (vc: { vehicleTypeId: number; capacity: number }) => ({
          vehicleTypeId: vc.vehicleTypeId,
          capacity: vc.capacity,
          occupied: 0,
        }),
      ),
    });
    departures.push(created);
    return created;
  });

  const unitOfWork: DepartureUnitOfWork = {
    run: async (work) => work({}),
    lockDepartureForUpdate,
    markDepartureCancelled,
    listBoardingsForDeparture,
    markBoardingCancelled,
    creditWalletRefund,
    createNotification,
    markDepartureFinished,
    createReturnQueuedDeparture,
  };

  const sampleBoardings: DepartureBoardingItem[] = [
    {
      id: "b-1",
      seatNumber: 1,
      passengerName: "Carlos Ruiz",
      passengerId: "user-1",
      isTicketOffice: false,
      fareCategory: "GENERAL",
      amountCharged: "7.00",
      status: "BOARDED",
      vehicleId: null,
      vehicleLabel: null,
      vehiclePlate: null,
    },
    {
      id: "b-2",
      seatNumber: 2,
      passengerName: "",
      passengerId: null,
      isTicketOffice: true,
      fareCategory: "GENERAL",
      amountCharged: "7.00",
      status: "BOARDED",
      vehicleId: "veh-1",
      vehicleLabel: "Honda Wave",
      vehiclePlate: "VER-123A",
    },
    {
      id: "b-3",
      seatNumber: 3,
      passengerName: "",
      passengerId: "user-3",
      isTicketOffice: false,
      fareCategory: "STUDENT",
      amountCharged: "5.00",
      status: "BOARDED",
      vehicleId: null,
      vehicleLabel: null,
      vehiclePlate: null,
    },
  ];

  const repo: DepartureRepository = {
    findDockById: vi.fn(async (id: string) => ({ id, code: id, name: id })),
    listDocks: vi.fn(async () => []),
    findEligibleVessel: vi.fn(async () => null),
    listEligibleVessels: vi.fn(async () => []),
    listDeparturesByDock: vi.fn(async (dockId: string) =>
      departures.filter((d) => d.originDockId === dockId),
    ),
    findDepartureById: vi.fn(async (id: string) => departures.find((d) => d.id === id) ?? null),
    findActiveBoardingByDock: vi.fn(
      async (dockId: string) =>
        departures.find((d) => d.originDockId === dockId && d.status === "BOARDING") ?? null,
    ),
    createDeparture: vi.fn(async (data) =>
      makeDeparture({
        id: "dep-created",
        vesselId: data.vesselId,
        driverId: data.driverId,
        originDockId: data.originDockId,
        destinationDockId: data.destinationDockId,
        status: data.status,
        queuePosition: data.queuePosition,
        passengerCapacity: data.passengerCapacity,
        returnOfId: data.returnOfId ?? null,
        boardingStartedAt: data.boardingStartedAt,
      }),
    ),
    updateDepartureStatus: vi.fn(async (upd) =>
      makeDeparture({
        id: upd.departureId,
        status: upd.toStatus,
        queuePosition: upd.queuePosition,
      }),
    ),
    applyQueuePositions: vi.fn(async () => undefined),
    listWaitlistByDock: vi.fn(async () => []),
    createWaitlistEntry: vi.fn(async () => {
      throw new Error("not used");
    }),
    findBoardingForUpdate,
    occupySeat: vi.fn(async () => 1),
    listBoardingsByDepartureId:
      params.withListBoardings === false ? undefined : vi.fn(async () => sampleBoardings),
    unitOfWork: params.withUnitOfWork === false ? undefined : unitOfWork,
  };

  return {
    repo,
    creditWalletRefund,
    markBoardingCancelled,
    createNotification,
    createReturnQueuedDeparture,
    findBoardingForUpdate,
  };
}

describe("Issue #46: cancelar salida, regreso y lista de abordados", () => {
  it("cancela salida con 3 abordados y devuelve el importe exacto a cada uno", async () => {
    const auditLog = vi.fn(async () => undefined);
    const {
      repo,
      creditWalletRefund,
      markBoardingCancelled,
      createNotification,
      findBoardingForUpdate,
    } = buildTestRepo({
      departures: [makeDeparture({ id: "dep-1", status: "BOARDING" })],
      boardingsForCancel: [
        {
          id: "b-1",
          departureId: "dep-1",
          saleId: "sale-1",
          saleChannel: "QR_BALANCE",
          passengerId: "p-1",
          seatNumber: 1,
          amountCharged: "7.00",
          status: "BOARDED",
        },
        {
          id: "b-2",
          departureId: "dep-1",
          saleId: "sale-2",
          saleChannel: "QR_BALANCE",
          passengerId: "p-2",
          seatNumber: 2,
          amountCharged: "5.00",
          status: "BOARDED",
        },
        {
          id: "b-3",
          departureId: "dep-1",
          saleId: "sale-3",
          saleChannel: "TICKET_OFFICE",
          passengerId: null,
          seatNumber: 3,
          amountCharged: "7.00",
          status: "BOARDED",
        },
      ],
    });

    const cancelDeparture = createCancelDeparture(repo, fixedClock, {
      log: auditLog,
    });
    const res = await cancelDeparture({
      departureId: "dep-1",
      cancelReason: "Norte fuerte en el río",
      actorUserId: "admin-1",
    });

    expect(res.departure.status).toBe("CANCELLED");
    expect(res.cancelledBoardingsCount).toBe(3);
    expect(res.refundedBalanceCount).toBe(2);
    expect(res.totalRefundedBalance).toBe("12.00");
    expect(res.refundsByBoarding).toEqual([
      {
        boardingId: "b-1",
        passengerId: "p-1",
        seatNumber: 1,
        channel: "QR_BALANCE",
        refundedAmount: "7.00",
        refundMethod: "WALLET",
      },
      {
        boardingId: "b-2",
        passengerId: "p-2",
        seatNumber: 2,
        channel: "QR_BALANCE",
        refundedAmount: "5.00",
        refundMethod: "WALLET",
      },
      {
        boardingId: "b-3",
        passengerId: null,
        seatNumber: 3,
        channel: "TICKET_OFFICE",
        refundedAmount: "7.00",
        refundMethod: "CASH_BOX",
      },
    ]);
    expect(res.cashRefundsReady).toEqual([
      {
        boardingId: "b-3",
        saleId: "sale-3",
        seatNumber: 3,
        amount: "7.00",
      },
    ]);
    expect(findBoardingForUpdate).toHaveBeenCalledTimes(1);
    expect(markBoardingCancelled).toHaveBeenCalledTimes(3);
    expect(creditWalletRefund).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledTimes(1);
  });

  it("rechaza cancelar salida en tránsito o sin motivo obligatorio", async () => {
    const { repo } = buildTestRepo({
      departures: [makeDeparture({ id: "dep-transit", status: "IN_TRANSIT" })],
    });
    const cancelDeparture = createCancelDeparture(repo, fixedClock);

    await expect(
      cancelDeparture({
        departureId: "dep-transit",
        cancelReason: "Clima",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      cancelDeparture({
        departureId: "dep-transit",
        cancelReason: "   ",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("al terminar un viaje crea salida de regreso en cola en el muelle destino con returnOfId", async () => {
    const auditLog = vi.fn(async () => undefined);
    const { repo } = buildTestRepo({
      departures: [
        makeDeparture({
          id: "dep-out",
          vesselId: "vessel-9",
          driverId: "driver-9",
          originDockId: "dock-coa",
          destinationDockId: "dock-val",
          status: "IN_TRANSIT",
          queuePosition: null,
          passengerCapacity: 100,
        }),
        makeDeparture({
          id: "dep-existing-val",
          originDockId: "dock-val",
          destinationDockId: "dock-coa",
          status: "QUEUED",
          queuePosition: 2,
        }),
      ],
    });

    const finishTrip = createFinishTrip(repo, fixedClock, { log: auditLog });
    const result = await finishTrip({
      departureId: "dep-out",
      actorUserId: "driver-9",
      actorDockId: "dock-val",
    });

    expect(result.finishedDeparture.status).toBe("FINISHED");
    expect(result.returnDeparture.status).toBe("QUEUED");
    expect(result.returnDeparture.originDockId).toBe("dock-val");
    expect(result.returnDeparture.destinationDockId).toBe("dock-coa");
    expect(result.returnDeparture.vesselId).toBe("vessel-9");
    expect(result.returnDeparture.driverId).toBe("driver-9");
    expect(result.returnDeparture.returnOfId).toBe("dep-out");
    expect(result.returnDeparture.queuePosition).toBe(3);
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(typeof createReturnDeparture).toBe("function");
  });

  it("valida errores en salida de regreso (id vacío, inexistente, muelle ajeno y sin unitOfWork)", async () => {
    const { repo: repoNoUow } = buildTestRepo({
      departures: [makeDeparture({ id: "dep-out", status: "IN_TRANSIT" })],
      withUnitOfWork: false,
    });
    const finishNoUow = createFinishTrip(repoNoUow, fixedClock);

    await expect(finishNoUow({ departureId: "  ", actorUserId: "driver-1" })).rejects.toThrow(
      DomainError,
    );

    await expect(
      finishNoUow({ departureId: "no-existe", actorUserId: "driver-1" }),
    ).rejects.toThrow(DomainError);

    await expect(
      finishNoUow({
        departureId: "dep-out",
        actorUserId: "driver-1",
        actorDockId: "otro-muelle",
      }),
    ).rejects.toThrow(DomainError);

    const resNoUow = await finishNoUow({
      departureId: "dep-out",
      actorUserId: "driver-1",
    });
    expect(resNoUow.finishedDeparture.status).toBe("FINISHED");
  });

  it("lista los abordados con boleto de taquilla, fallback de nombre y datos de vehículo", async () => {
    const { repo } = buildTestRepo({
      departures: [makeDeparture({ id: "dep-1", status: "BOARDING" })],
    });

    const listBoardings = createListDepartureBoardings(repo);
    const items = await listBoardings({
      departureId: "dep-1",
      actorDockId: "dock-coa",
    });

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      seatNumber: 1,
      passengerName: "Carlos Ruiz",
      amountCharged: "7.00",
    });
    expect(items[1]).toMatchObject({
      seatNumber: 2,
      passengerName: "Boleto de taquilla",
      vehicleLabel: "Honda Wave",
      vehiclePlate: "VER-123A",
    });
    expect(items[2]).toMatchObject({
      seatNumber: 3,
      passengerName: "Pasajero",
      amountCharged: "5.00",
    });

    const { repo: repoEmpty } = buildTestRepo({
      departures: [makeDeparture({ id: "dep-1", status: "BOARDING" })],
      withListBoardings: false,
    });
    await expect(
      createListDepartureBoardings(repoEmpty)({ departureId: "dep-1" }),
    ).resolves.toEqual([]);

    await expect(createListDepartureBoardings(repo)({ departureId: "" })).rejects.toThrow(
      DomainError,
    );
    await expect(createListDepartureBoardings(repo)({ departureId: "faltante" })).rejects.toThrow(
      DomainError,
    );
    await expect(
      createListDepartureBoardings(repo)({
        departureId: "dep-1",
        actorDockId: "muelle-ajeno",
      }),
    ).rejects.toThrow(DomainError);
  });
});
