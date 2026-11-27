import type { Fare, FareCategory, FareDefinition, VesselKind } from "@/domain/fares/fare";

export interface FareKey {
  vesselKind: VesselKind;
  category: FareCategory;
  vehicleTypeId: number | null;
}

export interface FareVehicleType {
  id: number;
  name: string;
}

export interface FareRepository {
  replaceCurrentFare(fare: FareDefinition): Promise<Fare>;
  listCurrentFares(at: Date): Promise<Fare[]>;
  listFareHistory(): Promise<Fare[]>;
  listVehicleTypes(): Promise<FareVehicleType[]>;
}
