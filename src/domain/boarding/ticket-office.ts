import { DomainError } from "@/domain/shared/domain-error";
import type { VesselKind } from "@/domain/fares/fare";
import type { FareOption, ResolvedFare } from "@/domain/fares/fare-strategy";

export function resolveTicketOfficeFare(
  fareId: string,
  vesselKind: VesselKind,
  fares: readonly FareOption[],
  at: Date,
): ResolvedFare {
  const fare = fares.find(
    (candidate) =>
      candidate.id === fareId &&
      candidate.vesselKind === vesselKind &&
      candidate.validFrom.getTime() <= at.getTime() &&
      (candidate.validTo === null || at.getTime() < candidate.validTo.getTime()),
  );
  if (!fare) {
    throw new DomainError(
      "FARE_NOT_CONFIGURED",
      "La tarifa seleccionada ya no está vigente. Actualiza la pantalla e intenta otra vez.",
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
