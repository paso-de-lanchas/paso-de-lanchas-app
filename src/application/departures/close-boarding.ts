import { DomainError } from "@/domain/shared/domain-error";
import { assertDepartureTransition } from "@/domain/departures/departure-state";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";
import { createStartNextBoarding } from "./start-next-boarding";

export interface CloseBoardingInput {
  departureId: string;
  actorUserId: string;
  actorDockId?: string | null;
}

export function createCloseBoarding(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  const startNextBoarding = createStartNextBoarding(repo, clock, auditLogger);

  return async function closeBoarding(
    input: CloseBoardingInput,
  ): Promise<{ closed: DepartureRecord; nextBoarding: DepartureRecord | null }> {
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

    if (input.actorDockId && input.actorDockId !== departure.originDockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Solo puedes cerrar el abordaje de salidas de tu muelle asignado.",
      );
    }

    assertDepartureTransition(departure.status, "BOARDING_CLOSED");

    const now = clock.now();
    const closed = await repo.updateDepartureStatus({
      departureId: departure.id,
      fromStatus: departure.status,
      toStatus: "BOARDING_CLOSED",
      queuePosition: null,
      boardingClosedAt: now,
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "DEPARTURE_BOARDING_CLOSED",
        entity: "departures",
        entityId: closed.id,
        details: {
          dockId: departure.originDockId,
          occupiedSeats: closed.occupiedSeats,
          passengerCapacity: closed.passengerCapacity,
          closedAt: now.toISOString(),
        },
      });
    }

    const nextBoarding = await startNextBoarding(departure.originDockId, input.actorUserId);

    return { closed, nextBoarding };
  };
}
