import type { DeviceAdminRepository, DeviceView } from "@/application/devices/ports";
import type { ChangeAudit } from "@/application/shared/ports";
import type { PrismaClient } from "@/generated/prisma/client";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";

/** El evento de bitácora de un cambio a la computadora `id`, para guardarlo en su transacción. */
function auditFor(id: string, audit: ChangeAudit) {
  return { data: auditLogData({ ...audit, entity: "authorized_device", entityId: id }) };
}

const deviceFields = {
  id: true,
  name: true,
  status: true,
  dockId: true,
  requestedAt: true,
  approvedAt: true,
  lastSeenAt: true,
  dock: { select: { name: true } },
  requestedBy: { select: { fullName: true, email: true, role: true, dockId: true } },
  approvedBy: { select: { fullName: true } },
} as const;

function toView(row: {
  id: string;
  name: string;
  status: DeviceView["status"];
  dockId: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  lastSeenAt: Date | null;
  dock: { name: string } | null;
  requestedBy: DeviceView["requestedBy"];
  approvedBy: { fullName: string } | null;
}): DeviceView {
  const { dock, approvedBy, ...view } = row;
  return { ...view, dockName: dock?.name ?? null, approvedByName: approvedBy?.fullName ?? null };
}

/** Computadoras del muelle en `authorized_devices` (RF-120, RF-121). */
export function prismaDeviceAdminRepository(db: PrismaClient): DeviceAdminRepository {
  return {
    async list(status) {
      const rows = await db.authorizedDevice.findMany({
        where: { status },
        select: deviceFields,
        orderBy: { requestedAt: "desc" },
      });
      return rows.map(toView);
    },
    async findById(id) {
      const row = await db.authorizedDevice.findUnique({ where: { id }, select: deviceFields });
      return row ? toView(row) : null;
    },
    listDocks: () =>
      db.dock.findMany({ select: { id: true, name: true }, orderBy: { code: "asc" } }),
    async dockExists(dockId) {
      return (await db.dock.count({ where: { id: dockId } })) > 0;
    },
    approve: (id, { name, dockId, approvedById, at }, audit) =>
      db.$transaction(async (tx) => {
        // Condición PENDING: si dos superadmins aprueban a la vez, solo cuenta la primera.
        const { count } = await tx.authorizedDevice.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "APPROVED", name, dockId, approvedById, approvedAt: at },
        });
        if (count === 0) return false;
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
    revoke: (id, audit) =>
      db.$transaction(async (tx) => {
        const { count } = await tx.authorizedDevice.updateMany({
          where: { id, status: { in: ["PENDING", "APPROVED"] } },
          data: { status: "REVOKED" },
        });
        if (count === 0) return false;
        // getCurrentUser ya rechaza sesiones de una computadora revocada; además se borran.
        await tx.session.deleteMany({ where: { deviceId: id } });
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
    rename: (id, name, audit) =>
      db.$transaction(async (tx) => {
        const { count } = await tx.authorizedDevice.updateMany({
          where: { id, status: { not: "REVOKED" } },
          data: { name },
        });
        if (count === 0) return false;
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
  };
}
