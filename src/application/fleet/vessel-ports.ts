import type { VehicleCapacityInput, VesselKind, VesselStatus } from "@/domain/fleet/vessel";

export interface VehicleTypeOption {
  id: number;
  name: string;
  active: boolean;
}

export interface VesselVehicleCapacityDetail {
  vehicleTypeId: number;
  vehicleTypeName: string;
  capacity: number;
}

export interface VesselDetail {
  id: string;
  code: string;
  name: string;
  kind: VesselKind;
  registration: string;
  color: string | null;
  photoUrl: string | null;
  passengerCapacity: number;
  status: VesselStatus;
  createdAt: Date;
  vehicleCapacities: VesselVehicleCapacityDetail[];
}

export interface CreateVesselData {
  code: string;
  name: string;
  kind: VesselKind;
  registration: string;
  color: string | null;
  photoUrl: string | null;
  passengerCapacity: number;
  vehicleCapacities: VehicleCapacityInput[];
}

export interface UpdateVesselData extends CreateVesselData {
  id: string;
}

export interface VesselFilters {
  kind?: VesselKind;
  status?: VesselStatus;
}

export interface VesselRepository {
  create(data: CreateVesselData): Promise<VesselDetail>;
  update(data: UpdateVesselData): Promise<VesselDetail>;
  findById(id: string): Promise<VesselDetail | null>;
  list(filters?: VesselFilters): Promise<VesselDetail[]>;
  listVehicleTypes(): Promise<VehicleTypeOption[]>;
}
