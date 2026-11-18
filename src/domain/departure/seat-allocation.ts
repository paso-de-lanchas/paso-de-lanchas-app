import { DomainError } from "../shared/domain-error";

/**
 * Regla de negocio "cero sobreventa", sin base de datos: dado el cupo de una salida,
 * decide si caben N boletos más y qué números de asiento les tocan.
 *
 * El caso de uso de abordaje la llama DENTRO de la transacción, después de bloquear la
 * salida con SELECT … FOR UPDATE. La base de datos tiene además un CHECK como última defensa.
 */
export interface DepartureCapacity {
  status: "QUEUED" | "BOARDING" | "BOARDING_CLOSED" | "IN_TRANSIT" | "FINISHED" | "CANCELLED";
  passengerCapacity: number;
  occupiedSeats: number;
}

export function allocateSeats(departure: DepartureCapacity, tickets: number): number[] {
  if (!Number.isInteger(tickets) || tickets < 1) {
    throw new DomainError("INVALID_TICKET_COUNT", "Debe venderse al menos un boleto.");
  }
  if (departure.status !== "BOARDING") {
    throw new DomainError("DEPARTURE_NOT_BOARDING", "Esta embarcación no está abordando.");
  }
  const free = departure.passengerCapacity - departure.occupiedSeats;
  if (tickets > free) {
    throw new DomainError(
      "DEPARTURE_FULL",
      free === 0
        ? "La embarcación está llena."
        : `Solo quedan ${free} lugares en esta embarcación.`,
    );
  }
  return Array.from({ length: tickets }, (_, i) => departure.occupiedSeats + i + 1);
}
