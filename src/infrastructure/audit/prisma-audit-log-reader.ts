import type { AuditLogReader } from "@/application/audit/list-audit-logs";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

/** Lectura de `audit_logs` con filtros; usa el índice de `created_at` para el orden. */
export function createPrismaAuditLogReader(db: PrismaClient = prisma): AuditLogReader {
  return {
    async list(query) {
      const where: Prisma.AuditLogWhereInput = {
        ...(query.action ? { action: query.action } : {}),
        ...(query.userEmail
          ? { user: { email: { contains: query.userEmail, mode: "insensitive" } } }
          : {}),
        ...(query.from || query.toExclusive
          ? {
              createdAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.toExclusive ? { lt: query.toExclusive } : {}),
              },
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: query.skip,
          take: query.take,
          select: {
            id: true,
            createdAt: true,
            action: true,
            entity: true,
            entityId: true,
            details: true,
            user: { select: { email: true, fullName: true } },
            device: { select: { name: true } },
          },
        }),
        db.auditLog.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((row) => ({
          id: row.id.toString(),
          createdAt: row.createdAt,
          userEmail: row.user?.email ?? null,
          userName: row.user?.fullName ?? null,
          deviceName: row.device?.name ?? null,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          details: row.details,
        })),
      };
    },

    async listActions() {
      const rows = await db.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      });
      return rows.map((row) => row.action);
    },
  };
}
