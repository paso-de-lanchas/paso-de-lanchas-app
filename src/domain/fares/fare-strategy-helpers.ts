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

export function dateKeyInMexico(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function dateKeyUtc(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
