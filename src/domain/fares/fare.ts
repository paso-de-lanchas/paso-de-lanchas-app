import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export type VesselKind = "BOAT" | "FERRY";
export type FareCategory = "GENERAL" | "STUDENT" | "INAPAM" | "PEDESTRIAN" | "VEHICLE";

export interface FareDefinition {
  vesselKind: VesselKind;
  category: FareCategory;
  vehicleTypeId: number | null;
  amount: Money;
  validFrom: Date;
  validTo: Date | null;
  createdById: string;
}

export interface Fare extends FareDefinition {
  id: string;
  vehicleTypeName: string | null;
}

export function createFare(input: FareDefinition): FareDefinition {
  if (input.amount.isNegative() || input.amount.cents > 9_999_999_999) {
    throw new DomainError(
      "INVALID_FARE_AMOUNT",
      "El monto debe estar entre $0.00 y $99,999,999.99.",
    );
  }

  const isBoatCategory = ["GENERAL", "STUDENT", "INAPAM"].includes(input.category);
  if (
    (input.vesselKind === "BOAT" && !isBoatCategory) ||
    (input.vesselKind === "FERRY" && isBoatCategory)
  ) {
    throw new DomainError(
      "INVALID_FARE_CATEGORY",
      "La categoría no corresponde a esta embarcación.",
    );
  }

  if (input.category === "VEHICLE") {
    const vehicleTypeId = input.vehicleTypeId;
    if (
      typeof vehicleTypeId !== "number" ||
      !Number.isSafeInteger(vehicleTypeId) ||
      vehicleTypeId <= 0
    ) {
      throw new DomainError("INVALID_VEHICLE_TYPE", "Selecciona un tipo de vehículo válido.");
    }
  } else if (input.vehicleTypeId !== null) {
    throw new DomainError(
      "INVALID_VEHICLE_TYPE",
      "Esta categoría no debe incluir un tipo de vehículo.",
    );
  }

  if (!Number.isFinite(input.validFrom.getTime())) {
    throw new DomainError("INVALID_FARE_DATE", "La fecha de inicio no es válida.");
  }
  if (
    input.validTo &&
    (!Number.isFinite(input.validTo.getTime()) ||
      input.validTo.getTime() <= input.validFrom.getTime())
  ) {
    throw new DomainError("INVALID_FARE_DATE", "La fecha de cierre debe ser posterior al inicio.");
  }
  if (!input.createdById) {
    throw new DomainError("INVALID_FARE_CREATOR", "No se pudo identificar al administrador.");
  }

  return input;
}
