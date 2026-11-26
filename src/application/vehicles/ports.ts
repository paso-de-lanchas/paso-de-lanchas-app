export type VehicleFaresMap = Map<number, number>;

export interface ActiveVehicleType {
  id: number;
  name: string;
}

export interface VehicleRecord {
  id: string;
  ownerId: string;
  vehicleTypeId: number;
  vehicleTypeName: string;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoUrl: string | null;
  deletedAt: Date | null;
}

export interface VehicleWithFare extends VehicleRecord {
  fareCents: number | null;
  formattedFare: string | null;
}

export interface CreateVehicleData {
  ownerId: string;
  vehicleTypeId: number;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoUrl: string | null;
}

export interface UpdateVehicleData {
  vehicleTypeId: number;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoUrl: string | null;
}

export interface VehicleRepository {
  findActiveTypes(): Promise<ActiveVehicleType[]>;
  isActiveType(vehicleTypeId: number): Promise<boolean>;
  listByOwner(ownerId: string): Promise<VehicleRecord[]>;
  findByIdAndOwner(vehicleId: string, ownerId: string): Promise<VehicleRecord | null>;
  create(data: CreateVehicleData): Promise<VehicleRecord>;
  update(
    vehicleId: string,
    ownerId: string,
    data: UpdateVehicleData,
  ): Promise<VehicleRecord | null>;
  softDelete(vehicleId: string, ownerId: string, deletedAt: Date): Promise<boolean>;
}

/**
 * Puerto desacoplado para obtener tarifas vigentes por tipo de vehículo (#15).
 * Permite conectar el cálculo Strategy cuando se fusione el PR #50 sin cambiar este módulo.
 */
export interface VehicleFareProvider {
  getCurrentVehicleFaresCents(at: Date): Promise<VehicleFaresMap>;
}
