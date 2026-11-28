import { DomainError } from "@/domain/shared/domain-error";

import { resolveCurrentFare } from "./fare-strategy-helpers";
import type { FareStrategy, FareStrategyInput, FareOption, ResolvedFare } from "./fare-strategy";

export class FerryFareStrategy implements FareStrategy {
  resolve(input: FareStrategyInput, fares: readonly FareOption[], at: Date): ResolvedFare {
    const vehicleTypeId = input.vehicleTypeId ?? null;
    if (vehicleTypeId !== null && (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId <= 0)) {
      throw new DomainError("INVALID_VEHICLE_TYPE", "Selecciona un tipo de vehículo válido.");
    }

    return resolveCurrentFare(
      fares,
      "FERRY",
      vehicleTypeId === null ? "PEDESTRIAN" : "VEHICLE",
      vehicleTypeId,
      at,
    );
  }
}
