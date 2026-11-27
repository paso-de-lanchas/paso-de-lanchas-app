import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import { pickNextInQueue, reorderQueue } from "@/domain/departures/queue";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";

const dockIdSchema = z.string().trim().min(1);

export function createStartNextBoarding(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  return async function startNextBoarding(
    dockId: string,
    actorUserId: string | null = null,
  ): Promise<DepartureRecord | null> {
    const parsedDockId = dockIdSchema.safeParse(dockId);
    if (!parsedDockId.success) {
      throw new DomainError("INVALID_DOCK_ID", "El identificador del muelle es inválido.");
    }
    const cleanDockId = parsedDockId.data;
    const now = clock.now();

    const updated = await repo.startNextBoardingInTx({
      dockId: cleanDockId,
      startedAt: now,
      pickNext: pickNextInQueue,
      reorderRemaining: (remaining) => reorderQueue(remaining),
    });

    if (!updated) {
      return null;
    }

    await auditLogger.log({
      userId: actorUserId,
      action: "DEPARTURE_BOARDING_STARTED",
      entity: "departures",
      entityId: updated.id,
      details: {
        dockId: cleanDockId,
        vesselId: updated.vesselId,
        startedAt: now.toISOString(),
      },
    });

    return updated;
  };
}
