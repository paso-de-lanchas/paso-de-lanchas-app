import { InputError, parseInput } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { assertValidVehicleDraft } from "@/domain/vehicles/vehicle";

import type { VehicleRecord, VehicleRepository } from "./ports";
import { type VehicleField, vehicleSchema } from "./vehicle-input";

export interface AddVehicleDeps {
  vehicles: VehicleRepository;
}

export function createAddVehicle(deps: AddVehicleDeps) {
  return async function addVehicle(ownerId: string, rawInput: unknown): Promise<VehicleRecord> {
    const validated = parseInput<VehicleField, typeof vehicleSchema>(vehicleSchema, rawInput);
    assertValidVehicleDraft(validated);

    const isActive = await deps.vehicles.isActiveType(validated.vehicleTypeId);
    if (!isActive) {
      throw new InputError<VehicleField>({
        vehicleTypeId: "El tipo de vehículo seleccionado no está disponible.",
      });
    }

    try {
      return await deps.vehicles.create({
        ownerId,
        ...validated,
      });
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
