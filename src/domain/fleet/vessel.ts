import { DomainError } from "@/domain/shared/domain-error";

export const VESSEL_KINDS = ["BOAT", "FERRY"] as const;
export type VesselKind = (typeof VESSEL_KINDS)[number];

export const VESSEL_STATUSES = ["ACTIVE", "MAINTENANCE", "SEIZED", "OUT_OF_SERVICE"] as const;
export type VesselStatus = (typeof VESSEL_STATUSES)[number];

export interface VehicleCapacityInput {
  vehicleTypeId: number;
  capacity: number;
}

export interface ValidateVesselRulesInput {
  code: string;
  name: string;
  kind: VesselKind;
  registration: string;
  passengerCapacity: number;
  vehicleCapacities?: VehicleCapacityInput[];
}

export function validateVesselRules(input: ValidateVesselRulesInput): {
  code: string;
  name: string;
  kind: VesselKind;
  registration: string;
  passengerCapacity: number;
  vehicleCapacities: VehicleCapacityInput[];
} {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const registration = input.registration.trim().toUpperCase();

  if (!code) {
    throw new DomainError("INVALID_VESSEL_CODE", "El código de la embarcación es obligatorio.");
  }
  if (!name) {
    throw new DomainError("INVALID_VESSEL_NAME", "El nombre de la embarcación es obligatorio.");
  }
  if (!registration) {
    throw new DomainError(
      "INVALID_VESSEL_REGISTRATION",
      "La matrícula de la embarcación es obligatoria.",
    );
  }
  if (!Number.isInteger(input.passengerCapacity) || input.passengerCapacity <= 0) {
    throw new DomainError(
      "INVALID_PASSENGER_CAPACITY",
      "La capacidad de pasajeros debe ser un entero mayor a 0.",
    );
  }

  const rawCapacities = input.vehicleCapacities ?? [];
  if (input.kind === "BOAT" && rawCapacities.some((c) => c.capacity > 0)) {
    throw new DomainError(
      "BOAT_CANNOT_CARRY_VEHICLES",
      "Una lancha no puede tener capacidad vehicular.",
    );
  }

  const seen = new Set<number>();
  const vehicleCapacities: VehicleCapacityInput[] = [];
  for (const item of rawCapacities) {
    if (!Number.isInteger(item.capacity) || item.capacity < 0) {
      throw new DomainError(
        "INVALID_VEHICLE_CAPACITY",
        "La capacidad por tipo de vehículo debe ser mayor o igual a 0.",
      );
    }
    if (seen.has(item.vehicleTypeId)) {
      throw new DomainError(
        "DUPLICATE_VEHICLE_TYPE_CAPACITY",
        "No se puede repetir el mismo tipo de vehículo.",
      );
    }
    seen.add(item.vehicleTypeId);
    if (input.kind === "FERRY") {
      vehicleCapacities.push({
        vehicleTypeId: item.vehicleTypeId,
        capacity: item.capacity,
      });
    }
  }

  return {
    code,
    name,
    kind: input.kind,
    registration,
    passengerCapacity: input.passengerCapacity,
    vehicleCapacities,
  };
}
