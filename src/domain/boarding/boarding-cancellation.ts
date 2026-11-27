import { DomainError } from "@/domain/shared/domain-error";

export function assertCanCancelBoarding(boardingStatus: string, departureStatus: string): void {
  if (boardingStatus !== "BOARDED") {
    throw new DomainError(
      "BOARDING_NOT_CANCELLABLE",
      "Este abordaje ya fue cancelado o reasignado.",
    );
  }
  if (departureStatus === "IN_TRANSIT" || departureStatus === "FINISHED") {
    throw new DomainError(
      "DEPARTURE_ALREADY_STARTED",
      "No se puede cancelar un abordaje cuando el viaje ya inició o finalizó.",
    );
  }
}
