import { DomainError } from "@/domain/shared/domain-error";

import { BoatFareStrategy } from "./boat-fare-strategy";
import { FerryFareStrategy } from "./ferry-fare-strategy";
import type { VesselKind } from "./fare";
import type { FareStrategy } from "./fare-strategy";

const boatFareStrategy = new BoatFareStrategy();
const ferryFareStrategy = new FerryFareStrategy();

export function createFareStrategy(vesselKind: VesselKind): FareStrategy {
  switch (vesselKind) {
    case "BOAT":
      return boatFareStrategy;
    case "FERRY":
      return ferryFareStrategy;
    default:
      throw new DomainError("INVALID_VESSEL_KIND", "Tipo de embarcación no válido.");
  }
}
