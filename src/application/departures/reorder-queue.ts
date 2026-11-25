import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import { reorderQueue } from "@/domain/departures/queue";
import type { AuditLogger } from "@/application/shared/ports";
import type { DepartureRepository } from "./ports";

const reorderQueueSchema = z.object({
  dockId: z.string().trim().min(1),
  orderedDepartureIds: z.array(z.string().trim().min(1)).min(1),
  actorUserId: z.string().trim().min(1),
  actorDockId: z.string().trim().min(1).nullable().optional(),
});

export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;

export function createReorderQueue(repo: DepartureRepository, auditLogger: AuditLogger) {
  return async function reorderDockQueue(input: ReorderQueueInput): Promise<void> {
    const parsedResult = reorderQueueSchema.safeParse(input);
    if (!parsedResult.success) {
      throw new DomainError(
        "INVALID_QUEUE_REORDER_INPUT",
        "Los datos para reordenar la fila son inválidos.",
      );
    }
    const parsed = parsedResult.data;

    if (!parsed.actorDockId || parsed.actorDockId !== parsed.dockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y solo puedes reordenar la fila de tu muelle.",
      );
    }

    const dockDepartures = await repo.listDeparturesByDock(parsed.dockId);
    const queued = dockDepartures.filter((d) => d.status === "QUEUED");
    const nextPositions = reorderQueue(queued, parsed.orderedDepartureIds);

    await repo.applyQueuePositions(parsed.dockId, nextPositions);

    await auditLogger.log({
      userId: parsed.actorUserId,
      action: "DEPARTURE_QUEUE_REORDERED",
      entity: "departures",
      entityId: parsed.dockId,
      details: {
        dockId: parsed.dockId,
        order: nextPositions,
      },
    });
  };
}
