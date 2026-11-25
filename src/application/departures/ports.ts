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
  returnOfId?: string | null;
  cancelReason?: string | null;
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
  driverId: string | null;
  originDockId: string;
  destinationDockId: string;
  status: DepartureStatus;
  queuePosition: number | null;
  passengerCapacity: number;
  returnOfId?: string | null;
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

export interface DepartureBoardingItem {
  id: string;
  seatNumber: number;
  passengerName: string;
  passengerId: string | null;
  isTicketOffice: boolean;
  fareCategory: string;
  amountCharged: string;
  status: "BOARDED" | "CANCELLED" | "REASSIGNED";
  vehicleId: string | null;
  vehicleLabel: string | null;
  vehiclePlate: string | null;
}

export interface DepartureBoardingForCancel {
  id: string;
  departureId: string;
  saleId: string;
  saleChannel: "QR_BALANCE" | "TICKET_OFFICE";
  passengerId: string | null;
  seatNumber: number;
  amountCharged: string;
  status: "BOARDED" | "CANCELLED" | "REASSIGNED";
}

export interface RefundPassengerInput {
  passengerId: string;
  boardingId: string;
  saleId: string;
  departureId: string;
  amountPesos: string;
  reason: string;
  performedById: string;
}

export interface CashRefundRecordInput {
  boardingId: string;
  saleId: string;
  departureId: string | null;
  passengerId: string | null;
  seatNumber: number;
  amountPesos: string;
  reason: string;
  performedById: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
}

export interface DepartureUnitOfWork {
  run<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
  lockDepartureForUpdate?(tx: unknown, departureId: string): Promise<DepartureRecord | null>;
  markDepartureCancelled(
    tx: unknown,
    params: {
      departureId: string;
      fromStatus: DepartureStatus;
      cancelReason: string;
    },
  ): Promise<DepartureRecord>;
  listBoardingsForDeparture(
    tx: unknown,
    departureId: string,
  ): Promise<DepartureBoardingForCancel[]>;
  markBoardingCancelled(
    tx: unknown,
    params: { boardingId: string; cancelReason: string },
  ): Promise<void>;
  creditWalletRefund(tx: unknown, input: RefundPassengerInput): Promise<void>;
  recordCashRefund(tx: unknown, input: CashRefundRecordInput): Promise<void>;
  createNotification(tx: unknown, input: CreateNotificationInput): Promise<void>;
  markDepartureFinished(
    tx: unknown,
    params: { departureId: string; finishedAt: Date; actorUserId: string },
  ): Promise<DepartureRecord>;
  createReturnQueuedDeparture(tx: unknown, data: CreateDepartureData): Promise<DepartureRecord>;
}

export interface DepartureRepository {
  findDockById(dockId: string): Promise<DockSummary | null>;
  listDocks(): Promise<DockSummary[]>;
  findEligibleVessel(vesselId: string): Promise<EligibleVessel | null>;
  listEligibleVessels(): Promise<EligibleVessel[]>;
  listDeparturesByDock(dockId: string): Promise<DepartureRecord[]>;
  findActiveDepartureByVessel(vesselId: string): Promise<DepartureRecord | null>;
  findDepartureById(departureId: string): Promise<DepartureRecord | null>;
  findActiveBoardingByDock(dockId: string): Promise<DepartureRecord | null>;
  createDeparture(data: CreateDepartureData): Promise<DepartureRecord>;
  enqueueDepartureInTx(params: {
    vesselId: string;
    driverId: string | null;
    originDockId: string;
    destinationDockId: string;
    passengerCapacity: number;
    vehicleCapacities: Array<{ vehicleTypeId: number; capacity: number }>;
    startedAt: Date;
  }): Promise<DepartureRecord>;
  startNextBoardingInTx(params: {
    dockId: string;
    startedAt: Date;
    pickNext: (queued: DepartureRecord[]) => DepartureRecord | null;
    reorderRemaining: (
      remaining: DepartureRecord[],
    ) => Array<{ id: string; queuePosition: number }>;
  }): Promise<DepartureRecord | null>;
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
  listBoardingsByDepartureId?(departureId: string): Promise<DepartureBoardingItem[]>;
  unitOfWork: DepartureUnitOfWork;
}
