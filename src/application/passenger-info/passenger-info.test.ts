import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/shared/ports";

import { createGetDocksStatus } from "./get-docks-status";
import { createGetScheduleAndFares } from "./get-schedule-and-fares";
import { createListMyTrips } from "./list-my-trips";
import type {
  CurrentFareRow,
  DocksLiveSnapshot,
  DockServiceHourRow,
  PaginatedTripsResult,
  PassengerInfoRepository,
  PassengerTripRow,
} from "./ports";

class InMemoryPassengerInfoRepository implements PassengerInfoRepository {
  snapshot: DocksLiveSnapshot = {
    docks: [
      { id: "dock-coa", code: "COA", name: "Coatzacoalcos" },
      { id: "dock-val", code: "VAL", name: "Villa Allende" },
    ],
    boardingDepartures: [],
    inboundDepartures: [],
    crossingMinutes: 10,
  };

  serviceHours: DockServiceHourRow[] = [];
  fares: CurrentFareRow[] = [];
  tripsByPassenger: Array<PassengerTripRow & { passengerId: string }> = [];

  async getDocksLiveSnapshot(): Promise<DocksLiveSnapshot> {
    return this.snapshot;
  }

  async getServiceHours(): Promise<DockServiceHourRow[]> {
    return this.serviceHours;
  }

  async getCurrentFares(): Promise<CurrentFareRow[]> {
    return this.fares;
  }

  async listPassengerTrips(
    passengerId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedTripsResult> {
    const filtered = this.tripsByPassenger
      .filter((t) => t.passengerId === passengerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * pageSize;
    return {
      rows: filtered.slice(start, start + pageSize),
      totalItems: filtered.length,
    };
  }
}

describe("passenger-info application use cases", () => {
  const fixedNow = new Date("2026-11-23T14:20:00.000Z");
  const fixedClock: Clock = { now: () => fixedNow };

  it("muestra simultáneamente una lancha y un transbordador abordando en el mismo muelle junto con embarcación en camino", async () => {
    const repo = new InMemoryPassengerInfoRepository();
    repo.snapshot.boardingDepartures.push(
      {
        id: "dep-boat-1",
        originDockId: "dock-coa",
        status: "BOARDING",
        vesselName: "Lancha 1",
        vesselKind: "BOAT",
        vesselColor: "Azul y blanco",
        vesselPhotoUrl: "https://ejemplo.test/lancha1.jpg",
        passengerCapacity: 20,
        occupiedSeats: 10,
        boardingStartedAt: new Date("2026-11-23T14:15:00.000Z"),
        driverName: "Chofer de prueba",
      },
      {
        id: "dep-ferry-1",
        originDockId: "dock-coa",
        status: "BOARDING_CLOSED",
        vesselName: "Transbordador 1",
        vesselKind: "FERRY",
        vesselColor: "Blanco",
        vesselPhotoUrl: null,
        passengerCapacity: 80,
        occupiedSeats: 65,
        boardingStartedAt: new Date("2026-11-23T14:00:00.000Z"),
        driverName: "Capitán Ferry",
      },
    );
    repo.snapshot.inboundDepartures.push({
      id: "dep-2",
      destinationDockId: "dock-coa",
      originDockName: "Villa Allende",
      vesselName: "Lancha 2",
      vesselKind: "BOAT",
      vesselColor: "Blanco",
      vesselPhotoUrl: null,
      departedAt: new Date("2026-11-23T14:14:00.000Z"),
    });

    const getDocksStatus = createGetDocksStatus({ repo, clock: fixedClock });
    const status = await getDocksStatus();

    expect(status.updatedAtIso).toBe("2026-11-23T14:20:00.000Z");
    expect(status.docks).toHaveLength(2);

    const coa = status.docks[0]!;
    expect(coa.dockName).toBe("Coatzacoalcos");
    expect(coa.boarding).toHaveLength(2);
    expect(coa.boarding[0]?.vesselName).toBe("Lancha 1");
    expect(coa.boarding[0]?.driverName).toBe("Chofer de prueba");
    expect(coa.boarding[0]?.estimatedDepartureLabel).toBe("5 min");
    expect(coa.boarding[1]?.vesselName).toBe("Transbordador 1");
    expect(coa.boarding[1]?.estimatedDepartureLabel).toBe("Abordaje cerrado · por salir");
    expect(coa.inbound?.vesselName).toBe("Lancha 2");
    expect(coa.inbound?.estimatedArrivalLabel).toBe("4 min");

    const val = status.docks[1]!;
    expect(val.boarding).toEqual([]);
    expect(val.inbound).toBeNull();
  });

  it("agrupa horarios de servicio por muelle y formatea las tarifas vigentes", async () => {
    const repo = new InMemoryPassengerInfoRepository();
    repo.serviceHours.push(
      {
        dockId: "dock-coa",
        dockCode: "COA",
        dockName: "Coatzacoalcos",
        weekday: 1,
        opensAt: new Date("1970-01-01T06:00:00.000Z"),
        closesAt: new Date("1970-01-01T22:00:00.000Z"),
      },
      {
        dockId: "dock-val",
        dockCode: "VAL",
        dockName: "Villa Allende",
        weekday: 0,
        opensAt: new Date("1970-01-01T07:00:00.000Z"),
        closesAt: new Date("1970-01-01T21:00:00.000Z"),
      },
    );
    repo.fares.push(
      {
        id: "f-1",
        vesselKind: "BOAT",
        category: "GENERAL",
        vehicleTypeId: null,
        vehicleTypeName: null,
        amountCents: 1000,
      },
      {
        id: "f-2",
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: 1,
        vehicleTypeName: "Automóvil",
        amountCents: 1500,
      },
    );

    const getScheduleAndFares = createGetScheduleAndFares({ repo, clock: fixedClock });
    const result = await getScheduleAndFares();

    expect(result.schedules).toHaveLength(2);
    expect(result.schedules[0]?.days[0]).toEqual({
      weekday: 1,
      weekdayName: "Lunes",
      opensAt: "06:00",
      closesAt: "22:00",
    });
    expect(result.schedules[1]?.days[0]?.weekdayName).toBe("Domingo");

    expect(result.fares).toHaveLength(2);
    expect(result.fares[0]?.label).toBe("Lancha · Pasajero general");
    expect(result.fares[0]?.formattedAmount).toContain("10.00");
    expect(result.fares[1]?.label).toBe("Transbordador · Vehículo (Automóvil)");
    expect(result.fares[1]?.formattedAmount).toContain("15.00");
  });

  it("lista únicamente los viajes del pasajero de la sesión ordenados del más reciente al más antiguo y paginados", async () => {
    const repo = new InMemoryPassengerInfoRepository();
    repo.tripsByPassenger.push(
      {
        id: "trip-old",
        passengerId: "user-1",
        createdAt: new Date("2026-11-20T10:00:00.000Z"),
        originDockName: "Coatzacoalcos",
        destinationDockName: "Villa Allende",
        vesselName: "Lancha 1",
        vesselKind: "BOAT",
        seatNumber: 4,
        fareCategory: "GENERAL",
        vehiclePlate: null,
        amountChargedCents: 1000,
        status: "BOARDED",
      },
      {
        id: "trip-new",
        passengerId: "user-1",
        createdAt: new Date("2026-11-23T09:30:00.000Z"),
        originDockName: "Villa Allende",
        destinationDockName: "Coatzacoalcos",
        vesselName: "Transbordador 1",
        vesselKind: "FERRY",
        seatNumber: 1,
        fareCategory: "VEHICLE",
        vehiclePlate: "YXZ123A",
        amountChargedCents: 1500,
        status: "BOARDED",
      },
      {
        id: "trip-other-user",
        passengerId: "user-2",
        createdAt: new Date("2026-11-23T11:00:00.000Z"),
        originDockName: "Coatzacoalcos",
        destinationDockName: "Villa Allende",
        vesselName: "Lancha 2",
        vesselKind: "BOAT",
        seatNumber: 2,
        fareCategory: "STUDENT",
        vehiclePlate: null,
        amountChargedCents: 500,
        status: "BOARDED",
      },
    );

    const listMyTrips = createListMyTrips({ repo, pageSize: 1 });

    const page1 = await listMyTrips("user-1", 1);
    expect(page1.totalItems).toBe(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.id).toBe("trip-new");
    expect(page1.items[0]?.vehiclePlate).toBe("YXZ123A");

    const page2 = await listMyTrips("user-1", 2);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.id).toBe("trip-old");
  });
});
