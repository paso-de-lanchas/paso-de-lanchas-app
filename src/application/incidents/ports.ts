import type { DepartureStatus } from "@/domain/departures/departure-state";

export type IncidentActionType = "REASSIGN" | "REFUND";

export interface IncidentRecord {
  id: string;
  vesselId: string;
  departureId: string | null;
  type: string;
  description: string;
  action: IncidentActionType;
  reportedById: string;
  createdAt: Date;
}

export interface IncidentDepartureSnapshot {
  id: string;
  vesselId: string;
  originDockId: string;
  status: DepartureStatus;
}

export interface IncidentBoardingItem {
  id: string;
  departureId: string;
  saleId: string;
  saleChannel: "QR_BALANCE" | "TICKET_OFFICE";
  passengerId: string | null;
  passengerName: string | null;
  seatNumber: number;
  amountCharged: string;
  status: "BOARDED" | "CANCELLED" | "REASSIGNED";
}

export interface IncidentUnitOfWork {
  run<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
  createIncident(
    tx: unknown,
    data: {
      vesselId: string;
      departureId: string | null;
      type: string;
      description: string;
      action: IncidentActionType;
      reportedById: string;
    },
  ): Promise<IncidentRecord>;
  lockDepartureForIncident?(
    tx: unknown,
    departureId: string,
  ): Promise<IncidentDepartureSnapshot | null>;
  cancelDepartureForIncident(
    tx: unknown,
    params: {
      departureId: string;
      fromStatus: DepartureStatus;
      cancelReason: string;
    },
  ): Promise<void>;
  listBoardingsForIncident(tx: unknown, departureId: string): Promise<IncidentBoardingItem[]>;
  markBoardingReassigned(tx: unknown, params: { boardingId: string }): Promise<void>;
  markBoardingCancelledByIncident(
    tx: unknown,
    params: { boardingId: string; cancelReason: string },
  ): Promise<void>;
  enqueuePriorityWaitlist(
    tx: unknown,
    params: {
      dockId: string;
      passengerId: string | null;
      label: string | null;
      priority: number;
      originBoardingId: string;
      createdById: string;
    },
  ): Promise<void>;
  creditWalletRefund(
    tx: unknown,
    params: {
      passengerId: string;
      saleId: string;
      amountPesos: string;
      reason: string;
      performedById: string;
    },
  ): Promise<void>;
  createNotification(
    tx: unknown,
    params: {
      userId: string;
      type: string;
      title: string;
      body: string;
    },
  ): Promise<void>;
}

export interface IncidentRepository {
  vesselExists(vesselId: string): Promise<boolean>;
  findDepartureSnapshot(departureId: string): Promise<IncidentDepartureSnapshot | null>;
  listRecentIncidentsByDock(dockId: string, limit?: number): Promise<IncidentRecord[]>;
  unitOfWork: IncidentUnitOfWork;
}
