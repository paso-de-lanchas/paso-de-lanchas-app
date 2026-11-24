import type { DeviceAdminRepository, DeviceView } from "@/application/devices/ports";
import type { PrismaClient } from "@/generated/prisma/client";

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
    async approve(id, { name, dockId, approvedById, at }) {
      // Condición PENDING: si dos superadmins aprueban a la vez, solo cuenta la primera.
      const { count } = await db.authorizedDevice.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", name, dockId, approvedById, approvedAt: at },
      });
      return count > 0;
    },
    revoke: (id) =>
      db.$transaction(async (tx) => {
        const { count } = await tx.authorizedDevice.updateMany({
          where: { id, status: { in: ["PENDING", "APPROVED"] } },
          data: { status: "REVOKED" },
        });
        if (count === 0) return false;
        // getCurrentUser ya rechaza sesiones de una computadora revocada; además se borran.
        await tx.session.deleteMany({ where: { deviceId: id } });
        return true;
      }),
    async rename(id, name) {
      const { count } = await db.authorizedDevice.updateMany({
        where: { id, status: { not: "REVOKED" } },
        data: { name },
      });
      return count > 0;
    },
  };
}
