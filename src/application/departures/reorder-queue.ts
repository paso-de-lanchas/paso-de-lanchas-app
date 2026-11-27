import { DomainError } from "@/domain/shared/domain-error";
import { reorderQueue } from "@/domain/departures/queue";
import type { AuditLogger } from "@/application/shared/ports";
import type { DepartureRepository } from "./ports";

export interface ReorderQueueInput {
  dockId: string;
  orderedDepartureIds: string[];
  actorUserId: string;
  actorDockId?: string | null;
}

export function createReorderQueue(repo: DepartureRepository, auditLogger?: AuditLogger) {
  return async function reorderDockQueue(input: ReorderQueueInput): Promise<void> {
    const dockId = input.dockId.trim();
    if (!dockId) {
      throw new DomainError("INVALID_DOCK_ID", "El identificador del muelle es obligatorio.");
    }

    if (input.actorDockId && input.actorDockId !== dockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Solo puedes reordenar la fila de tu muelle asignado.",
      );
    }

    const dockDepartures = await repo.listDeparturesByDock(dockId);
    const queued = dockDepartures.filter((d) => d.status === "QUEUED");
    const nextPositions = reorderQueue(queued, input.orderedDepartureIds);

    await repo.applyQueuePositions(dockId, nextPositions);

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "DEPARTURE_QUEUE_REORDERED",
        entity: "departures",
        entityId: dockId,
        details: {
          dockId,
          order: nextPositions,
        },
      });
    }
  };
}
