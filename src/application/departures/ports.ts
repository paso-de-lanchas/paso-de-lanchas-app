import type { DepartureStatus } from "@/domain/departures/departure-state";
import type { VesselKind } from "@/domain/fleet/vessel";

export interface DockSummary {
  id: string;
  code: string;
  name: string;
}

export interface EligibleVessel {
  id: string;
  code: string;
  name: string;
  kind: VesselKind;
  status: string;
  passengerCapacity: number;
  activeDriverId: string | null;
  vehicleCapacities: Array<{
    vehicleTypeId: number;
    capacity: number;
  }>;
}

export interface DepartureVehicleCapacityRecord {
  vehicleTypeId: number;
  capacity: number;
  occupied: number;
}

export interface DepartureRecord {
  id: string;
  vesselId: string;
  driverId: string | null;
  originDockId: string;
  destinationDockId: string;
  status: DepartureStatus;
  queuePosition: number | null;
  passengerCapacity: number;
  occupiedSeats: number;
  boardingStartedAt: Date | null;
  boardingClosedAt: Date | null;
  createdAt: Date;
  vehicleCapacities: DepartureVehicleCapacityRecord[];
}

export interface WaitlistEntryRecord {
  id: string;
  dockId: string;
  passengerId: string | null;
  label: string | null;
  status: "WAITING" | "BOARDED" | "REMOVED";
  priority: number;
  originBoardingId: string | null;
  boardingId: string | null;
  createdById: string;
  createdAt: Date;
}

export interface CreateDepartureData {
  vesselId: string;
  driverId: string;
  originDockId: string;
  destinationDockId: string;
  status: DepartureStatus;
  queuePosition: number | null;
  passengerCapacity: number;
  boardingStartedAt: Date | null;
  vehicleCapacities: Array<{
    vehicleTypeId: number;
    capacity: number;
  }>;
}

export interface CreateWaitlistEntryData {
  dockId: string;
  passengerId: string | null;
  label: string | null;
  createdById: string;
}

export interface DepartureRepository {
  findDockById(dockId: string): Promise<DockSummary | null>;
  listDocks(): Promise<DockSummary[]>;
  findEligibleVessel(vesselId: string): Promise<EligibleVessel | null>;
  listEligibleVessels(): Promise<EligibleVessel[]>;
  listDeparturesByDock(dockId: string): Promise<DepartureRecord[]>;
  findDepartureById(departureId: string): Promise<DepartureRecord | null>;
  findActiveBoardingByDock(dockId: string): Promise<DepartureRecord | null>;
  createDeparture(data: CreateDepartureData): Promise<DepartureRecord>;
  updateDepartureStatus(params: {
    departureId: string;
    fromStatus: DepartureStatus;
    toStatus: DepartureStatus;
    queuePosition: number | null;
    boardingStartedAt?: Date | null;
    boardingClosedAt?: Date | null;
  }): Promise<DepartureRecord>;
  applyQueuePositions(
    dockId: string,
    positions: Array<{ id: string; queuePosition: number }>,
  ): Promise<void>;
  listWaitlistByDock(dockId: string): Promise<WaitlistEntryRecord[]>;
  createWaitlistEntry(data: CreateWaitlistEntryData): Promise<WaitlistEntryRecord>;
  findBoardingForUpdate(tx: unknown, dockId: string): Promise<DepartureRecord | null>;
  occupySeat(tx: unknown, departureId: string): Promise<number>;
}
