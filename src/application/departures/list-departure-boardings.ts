import { DomainError } from "@/domain/shared/domain-error";
import type { DepartureBoardingItem, DepartureRepository } from "./ports";

export interface ListDepartureBoardingsInput {
  departureId: string;
  actorDockId?: string | null;
}

export function createListDepartureBoardings(repo: DepartureRepository) {
  return async function listDepartureBoardings(
    input: ListDepartureBoardingsInput,
  ): Promise<DepartureBoardingItem[]> {
    const departureId = input.departureId.trim();
    if (!departureId) {
      throw new DomainError(
        "INVALID_DEPARTURE_ID",
        "El identificador de la salida es obligatorio.",
      );
    }

    const departure = await repo.findDepartureById(departureId);
    if (!departure) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
    }

    if (
      !input.actorDockId ||
      (input.actorDockId !== departure.originDockId &&
        input.actorDockId !== departure.destinationDockId)
    ) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y operar únicamente desde tu muelle.",
      );
    }

    if (!repo.listBoardingsByDepartureId) {
      return [];
    }

    const items = await repo.listBoardingsByDepartureId(departureId);
    return items.map((item) => ({
      ...item,
      passengerName:
        item.passengerName.trim() || (item.isTicketOffice ? "Boleto de taquilla" : "Pasajero"),
    }));
  };
}
