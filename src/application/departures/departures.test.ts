import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import { createAddToWaitlist } from "./add-to-waitlist";
import { createCloseBoarding } from "./close-boarding";
import { createEnqueueDeparture } from "./enqueue-departure";
import type {
  CreateWaitlistEntryData,
  DepartureRecord,
  DepartureRepository,
  EligibleVessel,
  WaitlistEntryRecord,
} from "./ports";
import { createReorderQueue } from "./reorder-queue";

const fixedClock: Clock = {
  now: () => new Date("2026-11-23T18:00:00.000Z"),
};

function createFakeAuditLogger(): AuditLogger {
  return {
    log: vi.fn(async () => {}),
  };
}

function makeDeparture(overrides: Partial<DepartureRecord> & { id: string }): DepartureRecord {
  return {
    id: overrides.id,
    vesselId: overrides.vesselId ?? "vessel-1",
    driverId: overrides.driverId ?? "driver-1",
    originDockId: overrides.originDockId ?? "dock-coa",
    destinationDockId: overrides.destinationDockId ?? "dock-val",
    status: overrides.status ?? "QUEUED",
    queuePosition: overrides.queuePosition ?? 1,
    passengerCapacity: overrides.passengerCapacity ?? 40,
    occupiedSeats: overrides.occupiedSeats ?? 0,
    boardingStartedAt: overrides.boardingStartedAt ?? null,
    boardingClosedAt: overrides.boardingClosedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-11-23T17:00:00.000Z"),
    vehicleCapacities: overrides.vehicleCapacities ?? [],
  };
}

function createFakeRepo(params?: {
  vessel?: EligibleVessel | null;
  departures?: DepartureRecord[];
}): DepartureRepository {
  const departures = [...(params?.departures ?? [])];
  const defaultVessel: EligibleVessel = {
    id: "vessel-1",
    code: "T-01",
    name: "Transbordador 1",
    kind: "FERRY",
    status: "ACTIVE",
    passengerCapacity: 120,
    activeDriverId: "driver-1",
    vehicleCapacities: [{ vehicleTypeId: 1, capacity: 12 }],
  };
  const eligibleVessel: EligibleVessel | null =
    params?.vessel !== undefined ? params.vessel : defaultVessel;

  return {
    findDockById: vi.fn(async (dockId: string) =>
      dockId === "dock-coa" || dockId === "dock-val"
        ? { id: dockId, code: dockId.toUpperCase(), name: dockId }
        : null,
    ),
    listDocks: vi.fn(async () => [
      { id: "dock-coa", code: "COA", name: "Coatzacoalcos" },
      { id: "dock-val", code: "VAL", name: "Allende" },
    ]),
    findEligibleVessel: vi.fn(async () => eligibleVessel),
    listEligibleVessels: vi.fn(async () => (eligibleVessel ? [eligibleVessel] : [])),
    listDeparturesByDock: vi.fn(async (dockId: string) =>
      departures.filter((d) => d.originDockId === dockId),
    ),
    findActiveDepartureByVessel: vi.fn(
      async (vesselId: string) =>
        departures.find(
          (d) =>
            d.vesselId === vesselId &&
            (d.status === "QUEUED" ||
              d.status === "BOARDING" ||
              d.status === "BOARDING_CLOSED" ||
              d.status === "IN_TRANSIT"),
        ) ?? null,
    ),
    findDepartureById: vi.fn(async (id: string) => departures.find((d) => d.id === id) ?? null),
    findActiveBoardingByDock: vi.fn(
      async (dockId: string) =>
        departures.find((d) => d.originDockId === dockId && d.status === "BOARDING") ?? null,
    ),
    createDeparture: vi.fn(async (data) => {
      const rec = makeDeparture({
        id: `dep-${departures.length + 1}`,
        vesselId: data.vesselId,
        driverId: data.driverId,
        originDockId: data.originDockId,
        destinationDockId: data.destinationDockId,
        status: data.status,
        queuePosition: data.queuePosition,
        passengerCapacity: data.passengerCapacity,
        boardingStartedAt: data.boardingStartedAt,
        vehicleCapacities: data.vehicleCapacities.map(
          (vc: { vehicleTypeId: number; capacity: number }) => ({
            vehicleTypeId: vc.vehicleTypeId,
            capacity: vc.capacity,
            occupied: 0,
          }),
        ),
      });
      departures.push(rec);
      return rec;
    }),
    enqueueDepartureInTx: vi.fn(async (data) => {
      const hasBoarding = departures.some(
        (d) => d.originDockId === data.originDockId && d.status === "BOARDING",
      );
      const queuedCount = departures.filter(
        (d) => d.originDockId === data.originDockId && d.status === "QUEUED",
      ).length;
      const promoteToBoarding = !hasBoarding && queuedCount === 0;
      const rec = makeDeparture({
        id: `dep-${departures.length + 1}`,
        vesselId: data.vesselId,
        driverId: data.driverId,
        originDockId: data.originDockId,
        destinationDockId: data.destinationDockId,
        status: promoteToBoarding ? "BOARDING" : "QUEUED",
        queuePosition: promoteToBoarding ? null : queuedCount + 1,
        passengerCapacity: data.passengerCapacity,
        boardingStartedAt: promoteToBoarding ? data.startedAt : null,
        vehicleCapacities: data.vehicleCapacities.map((vc: { vehicleTypeId: number; capacity: number }) => ({
          vehicleTypeId: vc.vehicleTypeId,
          capacity: vc.capacity,
          occupied: 0,
        })),
      });
      departures.push(rec);
      return rec;
    }),
    startNextBoardingInTx: vi.fn(async ({ dockId, startedAt, pickNext, reorderRemaining }) => {
      const hasBoarding = departures.some(
        (d) => d.originDockId === dockId && d.status === "BOARDING",
      );
      if (hasBoarding) return null;
      const queued = departures.filter((d) => d.originDockId === dockId && d.status === "QUEUED");
      const next = pickNext(queued);
      if (!next) return null;
      const idx = departures.findIndex((d) => d.id === next.id);
      const updated = makeDeparture({
        ...departures[idx],
        status: "BOARDING",
        queuePosition: null,
        boardingStartedAt: startedAt,
      });
      departures[idx] = updated;
      const remaining = queued.filter((d) => d.id !== next.id);
      for (const pos of reorderRemaining(remaining)) {
        const rIdx = departures.findIndex((d) => d.id === pos.id);
        if (rIdx >= 0) {
          departures[rIdx] = { ...departures[rIdx], queuePosition: pos.queuePosition };
        }
      }
      return updated;
    }),
    updateDepartureStatus: vi.fn(async (upd) => {
      const idx = departures.findIndex((d) => d.id === upd.departureId);
      const updated = makeDeparture({
        ...departures[idx],
        status: upd.toStatus,
        queuePosition: upd.queuePosition,
        boardingStartedAt:
          upd.boardingStartedAt !== undefined
            ? upd.boardingStartedAt
            : departures[idx].boardingStartedAt,
        boardingClosedAt:
          upd.boardingClosedAt !== undefined
            ? upd.boardingClosedAt
            : departures[idx].boardingClosedAt,
      });
      departures[idx] = updated;
      return updated;
    }),
    applyQueuePositions: vi.fn(async (_dockId, positions) => {
      for (const pos of positions) {
        const idx = departures.findIndex((d) => d.id === pos.id);
        if (idx >= 0) {
          departures[idx] = {
            ...departures[idx],
            queuePosition: pos.queuePosition,
          };
        }
      }
    }),
    listWaitlistByDock: vi.fn(async () => []),
    createWaitlistEntry: vi.fn(
      async (entry: CreateWaitlistEntryData): Promise<WaitlistEntryRecord> => ({
        id: "wl-1",
        dockId: entry.dockId,
        passengerId: entry.passengerId,
        label: entry.label,
        status: "WAITING",
        priority: 0,
        originBoardingId: null,
        boardingId: null,
        createdById: entry.createdById,
        createdAt: fixedClock.now(),
      }),
    ),
  };
}

describe("departures use cases", () => {
  it("encola una salida copiando capacidad y pasa sola a BOARDING si no hay abordando", async () => {
    const repo = createFakeRepo();
    const audit = createFakeAuditLogger();
    const enqueue = createEnqueueDeparture(repo, fixedClock, audit);

    const dep = await enqueue({
      vesselId: "vessel-1",
      originDockId: "dock-coa",
      destinationDockId: "dock-val",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(dep.status).toBe("BOARDING");
    expect(dep.passengerCapacity).toBe(120);
    expect(dep.vehicleCapacities).toEqual([{ vehicleTypeId: 1, capacity: 12, occupied: 0 }]);
    expect(dep.boardingStartedAt).toEqual(fixedClock.now());
    expect(audit.log).toHaveBeenCalled();
  });

  it("impide encolar embarcación sin chofer asignado o con muelle de otro admin", async () => {
    const repoSinChofer = createFakeRepo({
      vessel: {
        id: "vessel-2",
        code: "L-02",
        name: "Lancha 2",
        kind: "BOAT",
        status: "ACTIVE",
        passengerCapacity: 30,
        activeDriverId: null,
        vehicleCapacities: [],
      },
    });
    const enqueueSinChofer = createEnqueueDeparture(
      repoSinChofer,
      fixedClock,
      createFakeAuditLogger(),
    );

    await expect(
      enqueueSinChofer({
        vesselId: "vessel-2",
        originDockId: "dock-coa",
        destinationDockId: "dock-val",
        actorUserId: "admin-1",
        actorDockId: "dock-coa",
      }),
    ).rejects.toThrow(DomainError);

    const enqueueOtroMuelle = createEnqueueDeparture(
      createFakeRepo(),
      fixedClock,
      createFakeAuditLogger(),
    );
    await expect(
      enqueueOtroMuelle({
        vesselId: "vessel-1",
        originDockId: "dock-coa",
        destinationDockId: "dock-val",
        actorUserId: "admin-1",
        actorDockId: "dock-val",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("cierra el abordaje y pasa sola a BOARDING la siguiente salida en fila", async () => {
    const repo = createFakeRepo({
      departures: [
        makeDeparture({
          id: "dep-1",
          status: "BOARDING",
          queuePosition: null,
        }),
        makeDeparture({
          id: "dep-2",
          status: "QUEUED",
          queuePosition: 1,
        }),
      ],
    });
    const closeBoarding = createCloseBoarding(repo, fixedClock, createFakeAuditLogger());

    const res = await closeBoarding({
      departureId: "dep-1",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(res.closed.status).toBe("BOARDING_CLOSED");
    expect(res.nextBoarding?.id).toBe("dep-2");
    expect(res.nextBoarding?.status).toBe("BOARDING");
  });

  it("reordena la fila y agrega entradas a la lista de espera sin cobro cuando no hay abordando", async () => {
    const repo = createFakeRepo({
      departures: [
        makeDeparture({ id: "dep-a", status: "QUEUED", queuePosition: 1 }),
        makeDeparture({ id: "dep-b", status: "QUEUED", queuePosition: 2 }),
      ],
    });
    const reorder = createReorderQueue(repo, createFakeAuditLogger());
    await reorder({
      dockId: "dock-coa",
      orderedDepartureIds: ["dep-b", "dep-a"],
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });
    expect(repo.applyQueuePositions).toHaveBeenCalledWith("dock-coa", [
      { id: "dep-b", queuePosition: 1 },
      { id: "dep-a", queuePosition: 2 },
    ]);

    const addWaitlist = createAddToWaitlist(repo, fixedClock, createFakeAuditLogger());
    const entry = await addWaitlist({
      dockId: "dock-coa",
      label: "Juan Pérez",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });
    expect(entry.label).toBe("Juan Pérez");
    expect(entry.status).toBe("WAITING");
  });

  it("impide registrar en lista de espera si ya hay una embarcación abordando", async () => {
    const repoConAbordaje = createFakeRepo({
      departures: [makeDeparture({ id: "dep-1", status: "BOARDING", queuePosition: null })],
    });
    const addWaitlist = createAddToWaitlist(
      repoConAbordaje,
      fixedClock,
      createFakeAuditLogger(),
    );

    await expect(
      addWaitlist({
        dockId: "dock-coa",
        label: "Ana López",
        actorUserId: "admin-1",
        actorDockId: "dock-coa",
      }),
    ).rejects.toThrow(DomainError);
  });
});


