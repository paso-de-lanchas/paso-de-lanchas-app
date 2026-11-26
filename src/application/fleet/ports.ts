import type { VesselStatus } from "@/domain/fleet/vessel-status";

export interface VesselRecord {
  id: string;
  code: string;
  name: string;
  status: VesselStatus;
}

export interface VesselStatusHistoryEntry {
  id: string;
  vesselId: string;
  fromStatus: VesselStatus;
  toStatus: VesselStatus;
  reason: string;
  changedById: string;
  changedByName: string | null;
  changedAt: Date;
}

export interface VesselTripHistoryEntry {
  id: string;
  originDockName: string;
  destinationDockName: string;
  status: string;
  departedAt: Date | null;
  arrivedAt: Date | null;
  createdAt: Date;
}

export interface ChangeVesselStatusInput {
  vesselId: string;
  toStatus: VesselStatus;
  reason: string;
  changedById: string;
}

export interface VesselStatusRepository {
  findVesselById(vesselId: string): Promise<VesselRecord | null>;
  changeStatusWithHistory(params: {
    vesselId: string;
    fromStatus: VesselStatus;
    toStatus: VesselStatus;
    reason: string;
    changedById: string;
  }): Promise<VesselStatusHistoryEntry>;
  getStatusHistory(vesselId: string): Promise<VesselStatusHistoryEntry[]>;
  getTripsByVesselId?(vesselId: string): Promise<VesselTripHistoryEntry[]>;
}
