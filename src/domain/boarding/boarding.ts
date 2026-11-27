import { DomainError } from "@/domain/shared/domain-error";
import type { Money } from "@/domain/shared/money";

/**
 * Reglas del abordaje con QR (RF-043 a RF-052). Son funciones puras: el caso de uso las
 * aplica DENTRO de la transacción, con la salida ya bloqueada (`SELECT … FOR UPDATE`).
 */

/** Error de abordaje con datos extra para la pantalla (p. ej. cuánto falta de saldo). */
export class BoardingError extends DomainError {
  constructor(
    code: BoardingErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code, message);
    this.name = "BoardingError";
  }
}

export type BoardingErrorCode =
  | "NO_DOCK_ASSIGNED"
  | "AUTHORIZED_DEVICE_REQUIRED"
  | "QR_REJECTED"
  | "QR_ALREADY_USED"
  | "PASSENGER_NOT_ACTIVE"
  | "NO_DEPARTURE_BOARDING"
  | "DEPARTURE_FULL"
  | "ALREADY_BOARDED"
  | "VEHICLE_NOT_ALLOWED"
  | "VEHICLE_NOT_FOUND"
  | "VEHICLE_CHOICE_REQUIRED"
  | "VEHICLE_SPACE_FULL"
  | "INSUFFICIENT_BALANCE";

export interface BoardingDepartureState {
  status: string;
  passengerCapacity: number;
  occupiedSeats: number;
}

/** La salida debe estar abordando y con al menos un lugar libre (cero sobreventa, RF-046). */
export function assertSeatAvailable(departure: BoardingDepartureState): void {
  if (departure.status !== "BOARDING") {
    throw new BoardingError(
      "NO_DEPARTURE_BOARDING",
      "No hay ninguna embarcación abordando en este muelle.",
    );
  }
  if (departure.occupiedSeats >= departure.passengerCapacity) {
    throw new BoardingError("DEPARTURE_FULL", "La embarcación ya está llena.", {
      capacity: departure.passengerCapacity,
    });
  }
}

/** Con este abordaje, ¿la salida queda llena? Entonces se cierra y pasa la siguiente. */
export function isFullAfterBoarding(departure: BoardingDepartureState): boolean {
  return departure.occupiedSeats + 1 >= departure.passengerCapacity;
}

/**
 * Lugares consecutivos por salida (RF-048). Se toma el mayor número ya usado, incluso de
 * abordajes cancelados, porque `(departure_id, seat_number)` es único y un lugar cancelado
 * no se vuelve a numerar.
 */
export function nextSeatNumber(highestSeatUsed: number | null): number {
  if (highestSeatUsed === null) return 1;
  if (!Number.isSafeInteger(highestSeatUsed) || highestSeatUsed < 0) {
    throw new DomainError("INVALID_SEAT", "El número de lugar registrado no es válido.");
  }
  return highestSeatUsed + 1;
}

export interface VehicleSpace {
  capacity: number;
  occupied: number;
}

/** Hay espacio para un vehículo de ese tipo en la salida (RF-046). */
export function assertVehicleSpace(space: VehicleSpace | null, vehicleTypeName: string): void {
  if (!space || space.occupied >= space.capacity) {
    throw new BoardingError(
      "VEHICLE_SPACE_FULL",
      `Ya no hay espacio para ${vehicleTypeName.toLowerCase()} en esta embarcación.`,
    );
  }
}

/** Saldo insuficiente: no se cobra y se dice cuánto falta (RF-047). */
export function assertEnoughBalance(balance: Money, fare: Money): void {
  if (balance.isLessThan(fare)) {
    const shortfall = fare.subtract(balance);
    throw new BoardingError(
      "INSUFFICIENT_BALANCE",
      `Saldo insuficiente: faltan ${shortfall.format()}.`,
      {
        balanceCents: balance.cents,
        fareCents: fare.cents,
        shortfallCents: shortfall.cents,
      },
    );
  }
}
