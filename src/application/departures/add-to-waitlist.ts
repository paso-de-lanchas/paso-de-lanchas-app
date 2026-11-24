import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRepository, WaitlistEntryRecord } from "./ports";

export interface AddToWaitlistInput {
  dockId: string;
  passengerId?: string | null;
  label?: string | null;
  actorUserId: string;
  actorDockId?: string | null;
}

export function createAddToWaitlist(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  return async function addToWaitlist(input: AddToWaitlistInput): Promise<WaitlistEntryRecord> {
    const dockId = input.dockId.trim();
    const passengerId = input.passengerId?.trim() ? input.passengerId.trim() : null;
    const label = input.label?.trim() ? input.label.trim() : null;

    if (!dockId) {
      throw new DomainError("INVALID_DOCK_ID", "El identificador del muelle es obligatorio.");
    }

    if (input.actorDockId && input.actorDockId !== dockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Solo puedes registrar pasajeros en la lista de espera de tu muelle.",
      );
    }

    if (!passengerId && !label) {
      throw new DomainError(
        "INVALID_WAITLIST_ENTRY",
        "Debes indicar un pasajero con cuenta o un nombre de referencia.",
      );
    }

    const dock = await repo.findDockById(dockId);
    if (!dock) {
      throw new DomainError("DOCK_NOT_FOUND", "No se encontró el muelle indicado.");
    }

    const created = await repo.createWaitlistEntry({
      dockId,
      passengerId,
      label,
      createdById: input.actorUserId,
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "WAITLIST_ENTRY_ADDED",
        entity: "waitlist_entries",
        entityId: created.id,
        details: {
          dockId,
          passengerId,
          label,
          createdAt: clock.now().toISOString(),
        },
      });
    }

    return created;
  };
}
