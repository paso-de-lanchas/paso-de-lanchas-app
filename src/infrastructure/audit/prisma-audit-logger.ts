import type { AuditEntry, AuditLogger } from "@/application/shared/ports";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Fila de `audit_logs` para una acción; sirve igual fuera o dentro de una transacción. */
export function auditLogData({
  userId,
  deviceId,
  action,
  entity,
  entityId,
  details,
}: AuditEntry): Prisma.AuditLogUncheckedCreateInput {
  return {
    userId,
    deviceId: deviceId ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    details: details as Prisma.InputJsonValue | undefined,
  };
}

/** Bitácora de auditoría en `audit_logs` (la base impide modificar o borrar registros). */
export function prismaAuditLogger(db: PrismaClient): AuditLogger {
  return {
    async log(entry) {
      await db.auditLog.create({ data: auditLogData(entry) });
    },
  };
}
