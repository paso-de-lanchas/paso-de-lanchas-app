import { DomainError } from "@/domain/shared/domain-error";
import { VesselNotFoundError } from "./change-vessel-status";
import type {
  VesselStatusHistoryEntry,
  VesselStatusRepository,
  VesselTripHistoryEntry,
} from "./ports";

export interface VesselHistoryOutput {
  vesselId: string;
  statusHistory: VesselStatusHistoryEntry[];
  trips: VesselTripHistoryEntry[];
}

export function createGetVesselHistory(repo: VesselStatusRepository) {
  return async function getVesselHistory(vesselId: string): Promise<VesselHistoryOutput> {
    const cleanId = vesselId.trim();
    if (!cleanId) {
      throw new DomainError(
        "INVALID_VESSEL_ID",
        "El identificador de la embarcación es obligatorio.",
      );
    }

    const vessel = await repo.findVesselById(cleanId);
    if (!vessel) {
      throw new VesselNotFoundError(cleanId);
    }

    const [statusHistory, trips] = await Promise.all([
      repo.getStatusHistory(cleanId),
      repo.getTripsByVesselId ? repo.getTripsByVesselId(cleanId) : Promise.resolve([]),
    ]);

    return {
      vesselId: vessel.id,
      statusHistory,
      trips,
    };
  };
}
