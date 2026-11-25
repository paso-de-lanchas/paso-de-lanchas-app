import { type Clock, systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import type { VehicleRepository } from "./ports";

export interface RemoveVehicleDeps {
  vehicles: VehicleRepository;
  clock?: Clock;
}

export function createRemoveVehicle(deps: RemoveVehicleDeps) {
  const clock = deps.clock ?? systemClock;

  return async function removeVehicle(ownerId: string, vehicleId: string): Promise<void> {
    const removed = await deps.vehicles.softDelete(vehicleId, ownerId, clock.now());
    if (!removed) {
      throw new DomainError("VEHICLE_NOT_FOUND", "No encontrado");
    }
  };
}
