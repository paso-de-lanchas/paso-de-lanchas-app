import type { AuditLogger } from "@/application/shared/ports";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Bitácora de auditoría en `audit_logs` (la base impide modificar o borrar registros). */
export function prismaAuditLogger(db: PrismaClient): AuditLogger {
  return {
    async log({ userId, deviceId, action, entity, entityId, details }) {
      await db.auditLog.create({
        data: {
          userId,
          deviceId: deviceId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          details: details as Prisma.InputJsonValue | undefined,
        },
      });
    },
  };
}
