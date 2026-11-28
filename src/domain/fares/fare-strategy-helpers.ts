import { DomainError } from "@/domain/shared/domain-error";

import type { FareCategory, VesselKind } from "./fare";
import type { FareOption, ResolvedFare } from "./fare-strategy";

export function resolveCurrentFare(
  fares: readonly FareOption[],
  vesselKind: VesselKind,
  category: FareCategory,
  vehicleTypeId: number | null,
  at: Date,
): ResolvedFare {
  const fare = fares.find(
    (candidate) =>
      candidate.vesselKind === vesselKind &&
      candidate.category === category &&
      candidate.vehicleTypeId === vehicleTypeId &&
      candidate.validFrom.getTime() <= at.getTime() &&
      (candidate.validTo === null || at.getTime() < candidate.validTo.getTime()),
  );
  if (!fare) {
    const categoryLabel = category === "VEHICLE" ? ` para el vehículo ${vehicleTypeId}` : "";
    throw new DomainError(
      "FARE_NOT_CONFIGURED",
      `No hay una tarifa vigente configurada para ${vesselKind === "BOAT" ? "lancha" : "transbordador"} (${category.toLowerCase()}${categoryLabel}).`,
    );
  }

  return {
    fareId: fare.id,
    vesselKind: fare.vesselKind,
    category: fare.category,
    vehicleTypeId: fare.vehicleTypeId,
    amount: fare.amount,
  };
}
