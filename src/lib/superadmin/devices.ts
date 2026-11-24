import {
  createApproveDevice,
  createListDevices,
  createRenameDevice,
  createRevokeDevice,
} from "@/application/devices/device-use-cases";
import { systemClock } from "@/application/shared/ports";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { prismaDeviceAdminRepository } from "@/infrastructure/devices/prisma-device-admin-repository";

/**
 * Computadoras del muelle (issue #42) armadas con sus implementaciones reales. Solo se usa en
 * el servidor, y siempre después de `assertRole("SUPERADMIN")` o `requireRole("SUPERADMIN")`.
 */
const deps = {
  devices: prismaDeviceAdminRepository(prisma),
  audit: prismaAuditLogger(prisma),
  clock: systemClock,
};

export const listDevices = createListDevices(deps);
export const approveDevice = createApproveDevice(deps);
export const revokeDevice = createRevokeDevice(deps);
export const renameDevice = createRenameDevice(deps);
