import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import { assertDepartureTransition } from "@/domain/departures/departure-state";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";
import { createStartNextBoarding } from "./start-next-boarding";

const closeBoardingSchema = z.object({
  departureId: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
  actorDockId: z.string().trim().min(1).nullable().optional(),
});

export type CloseBoardingInput = z.infer<typeof closeBoardingSchema>;

export function createCloseBoarding(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  const startNextBoarding = createStartNextBoarding(repo, clock, auditLogger);

  return async function closeBoarding(
    input: CloseBoardingInput,
  ): Promise<{ closed: DepartureRecord; nextBoarding: DepartureRecord | null }> {
    const parsedResult = closeBoardingSchema.safeParse(input);
    if (!parsedResult.success) {
      throw new DomainError("INVALID_DEPARTURE_ID", "El identificador de la salida es inválido.");
    }
    const parsed = parsedResult.data;

    const departure = await repo.findDepartureById(parsed.departureId);
    if (!departure) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
    }

    if (!parsed.actorDockId || parsed.actorDockId !== departure.originDockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y solo puedes operar salidas de tu muelle.",
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

    await auditLogger.log({
      userId: parsed.actorUserId,
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

    const nextBoarding = await startNextBoarding(departure.originDockId, parsed.actorUserId);

    return { closed, nextBoarding };
  };
}
