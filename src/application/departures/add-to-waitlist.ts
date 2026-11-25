import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRepository, WaitlistEntryRecord } from "./ports";

const addToWaitlistSchema = z.object({
  dockId: z.string().trim().min(1),
  passengerId: z.string().trim().min(1).nullable().optional(),
  label: z.string().trim().min(1).max(80).nullable().optional(),
  actorUserId: z.string().trim().min(1),
  actorDockId: z.string().trim().min(1).nullable().optional(),
});

export type AddToWaitlistInput = z.infer<typeof addToWaitlistSchema>;

export function createAddToWaitlist(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  return async function addToWaitlist(input: AddToWaitlistInput): Promise<WaitlistEntryRecord> {
    const parsedResult = addToWaitlistSchema.safeParse(input);
    if (!parsedResult.success) {
      throw new DomainError(
        "INVALID_WAITLIST_INPUT",
        "Los datos de la lista de espera son inválidos.",
      );
    }
    const parsed = parsedResult.data;
    const passengerId = parsed.passengerId ?? null;
    const label = parsed.label ?? null;

    if (!parsed.actorDockId || parsed.actorDockId !== parsed.dockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y solo puedes registrar en la lista de tu muelle.",
      );
    }

    if (!passengerId && !label) {
      throw new DomainError(
        "INVALID_WAITLIST_ENTRY",
        "Debes indicar un pasajero con cuenta o un nombre de referencia.",
      );
    }

    const dock = await repo.findDockById(parsed.dockId);
    if (!dock) {
      throw new DomainError("DOCK_NOT_FOUND", "No se encontró el muelle indicado.");
    }

    const activeBoarding = await repo.findActiveBoardingByDock(parsed.dockId);
    if (activeBoarding) {
      throw new DomainError(
        "BOARDING_ACTIVE_WAITLIST_NOT_ALLOWED",
        "Solo se puede registrar en lista de espera cuando no hay embarcación abordando.",
      );
    }

    const created = await repo.createWaitlistEntry({
      dockId: parsed.dockId,
      passengerId,
      label,
      createdById: parsed.actorUserId,
    });

    await auditLogger.log({
      userId: parsed.actorUserId,
      action: "WAITLIST_ENTRY_ADDED",
      entity: "waitlist_entries",
      entityId: created.id,
      details: {
        dockId: parsed.dockId,
        passengerId,
        label,
        createdAt: clock.now().toISOString(),
      },
    });

    return created;
  };
}
