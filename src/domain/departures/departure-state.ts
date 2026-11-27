import { DomainError } from "@/domain/shared/domain-error";

export const DEPARTURE_STATUSES = [
  "QUEUED",
  "BOARDING",
  "BOARDING_CLOSED",
  "IN_TRANSIT",
  "FINISHED",
  "CANCELLED",
] as const;

export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<DepartureStatus, readonly DepartureStatus[]> = {
  QUEUED: ["BOARDING", "CANCELLED"],
  BOARDING: ["BOARDING_CLOSED", "CANCELLED"],
  BOARDING_CLOSED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["FINISHED"],
  FINISHED: [],
  CANCELLED: [],
};

export function canTransitionDeparture(from: DepartureStatus, to: DepartureStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertDepartureTransition(
  from: DepartureStatus,
  to: DepartureStatus,
): DepartureStatus {
  if (!canTransitionDeparture(from, to)) {
    throw new DomainError(
      "INVALID_DEPARTURE_TRANSITION",
      `No se puede cambiar la salida de ${from} a ${to}.`,
    );
  }
  return to;
}
