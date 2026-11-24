import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DockServiceOverrideRecord, ScheduleRepository } from "./ports";

export interface SetExtraServiceInput {
  dockId: string;
  enabled: boolean;
  reason: string;
  endsAt?: Date | null;
  actorUserId: string;
  actorDockId?: string | null;
}

export interface SetExtraServiceResult {
  enabled: boolean;
  override: DockServiceOverrideRecord | null;
  closedCount: number;
}

export function createSetExtraService(
  repo: ScheduleRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  return async function setExtraService(
    input: SetExtraServiceInput,
  ): Promise<SetExtraServiceResult> {
    const dockId = input.dockId.trim();
    const reason = input.reason.trim();

    if (!dockId) {
      throw new DomainError("INVALID_DOCK_ID", "El identificador del muelle es obligatorio.");
    }

    if (input.actorDockId && input.actorDockId !== dockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Solo puedes modificar el servicio extraordinario de tu muelle.",
      );
    }

    if (!reason) {
      throw new DomainError(
        "OVERRIDE_REASON_REQUIRED",
        "El motivo es obligatorio para habilitar o quitar el servicio extraordinario.",
      );
    }

    const now = clock.now();

    if (input.enabled) {
      const endsAt = input.endsAt ?? null;
      if (endsAt && endsAt.getTime() <= now.getTime()) {
        throw new DomainError(
          "INVALID_OVERRIDE_WINDOW",
          "La hora de término del servicio extraordinario debe ser posterior al momento actual.",
        );
      }

      const closedCount = await repo.closeActiveOverrides({
        dockId,
        type: "EXTRA_SERVICE",
        endedAt: now,
      });

      const override = await repo.createOverride({
        dockId,
        type: "EXTRA_SERVICE",
        reason,
        startsAt: now,
        endsAt,
        createdById: input.actorUserId,
      });

      if (auditLogger) {
        await auditLogger.log({
          userId: input.actorUserId,
          action: "EXTRA_SERVICE_ENABLED",
          entity: "dock_service_overrides",
          entityId: override.id,
          details: {
            dockId,
            reason,
            startsAt: now.toISOString(),
            endsAt: endsAt ? endsAt.toISOString() : null,
          },
        });
      }

      return {
        enabled: true,
        override,
        closedCount,
      };
    }

    const closedCount = await repo.closeActiveOverrides({
      dockId,
      type: "EXTRA_SERVICE",
      endedAt: now,
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "EXTRA_SERVICE_DISABLED",
        entity: "dock_service_overrides",
        entityId: dockId,
        details: {
          dockId,
          reason,
          closedCount,
          endedAt: now.toISOString(),
        },
      });
    }

    return {
      enabled: false,
      override: null,
      closedCount,
    };
  };
}
