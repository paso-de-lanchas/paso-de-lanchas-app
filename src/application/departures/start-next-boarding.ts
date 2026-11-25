import { DomainError } from "@/domain/shared/domain-error";
import { pickNextInQueue, reorderQueue } from "@/domain/departures/queue";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";

export function createStartNextBoarding(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  return async function startNextBoarding(
    dockId: string,
    actorUserId: string | null = null,
  ): Promise<DepartureRecord | null> {
    const cleanDockId = dockId.trim();
    if (!cleanDockId) {
      throw new DomainError("INVALID_DOCK_ID", "El identificador del muelle es obligatorio.");
    }

    const now = clock.now();
    if (repo.isServiceOpenAt) {
      const scheduleStatus = await repo.isServiceOpenAt(cleanDockId, now);
      if (!scheduleStatus.open) {
        throw new DomainError(
          "SERVICE_CLOSED",
          scheduleStatus.reason ?? "El servicio del muelle está cerrado fuera de horario.",
        );
      }
    }

    const currentBoarding = await repo.findActiveBoardingByDock(cleanDockId);
    if (currentBoarding) {
      return null;
    }

    const dockDepartures = await repo.listDeparturesByDock(cleanDockId);
    const queued = dockDepartures.filter((d) => d.status === "QUEUED");
    if (queued.length === 0) {
      return null;
    }

    const next = pickNextInQueue(queued);
    if (!next) {
      return null;
    }

    const updated = await repo.updateDepartureStatus({
      departureId: next.id,
      fromStatus: "QUEUED",
      toStatus: "BOARDING",
      queuePosition: null,
      boardingStartedAt: now,
    });

    const remainingQueued = queued.filter((d) => d.id !== next.id);
    if (remainingQueued.length > 0) {
      const reordered = reorderQueue(remainingQueued);
      await repo.applyQueuePositions(cleanDockId, reordered);
    }

    if (auditLogger) {
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
    }

    return updated;
  };
}
