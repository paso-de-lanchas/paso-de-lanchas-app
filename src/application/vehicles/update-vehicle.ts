import { InputError, parseInput } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { assertValidVehicleDraft } from "@/domain/vehicles/vehicle";

import type { VehicleRecord, VehicleRepository } from "./ports";
import { type VehicleField, vehicleSchema } from "./vehicle-input";

export interface UpdateVehicleDeps {
  vehicles: VehicleRepository;
}

export function createUpdateVehicle(deps: UpdateVehicleDeps) {
  return async function updateVehicle(
    ownerId: string,
    vehicleId: string,
    rawInput: unknown,
  ): Promise<VehicleRecord> {
    const validated = parseInput<VehicleField, typeof vehicleSchema>(vehicleSchema, rawInput);
    assertValidVehicleDraft(validated);

    const isActive = await deps.vehicles.isActiveType(validated.vehicleTypeId);
    if (!isActive) {
      throw new InputError<VehicleField>({
        vehicleTypeId: "El tipo de vehículo seleccionado no está disponible.",
      });
    }

    try {
      const updated = await deps.vehicles.update(vehicleId, ownerId, validated);
      if (!updated) {
        throw new DomainError("VEHICLE_NOT_FOUND", "No encontrado");
      }
      return updated;
    } catch (error) {
      if (error instanceof DomainError && error.code === "DUPLICATE_PLATE") {
        throw new InputError<VehicleField>({
          plate: "Ya registraste un vehículo con esas placas.",
        });
      }
      throw error;
    }
  };
}
