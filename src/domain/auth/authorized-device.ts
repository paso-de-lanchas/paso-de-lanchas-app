import type { Role } from "./roles";

/**
 * Computadoras autorizadas (RF-011): el administrador y el superadministrador solo inician
 * sesión desde una computadora aprobada por el superadministrador. El administrador, además,
 * solo desde una computadora de su muelle. El chofer usa su celular y no lo necesita.
 */
export type DeviceStatus = "PENDING" | "APPROVED" | "REVOKED";

export function requiresAuthorizedDevice(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export type DeviceCheck = "ALLOWED" | "UNKNOWN" | "PENDING" | "REVOKED" | "WRONG_DOCK";

export function checkDevice(
  user: { role: Role; dockId: string | null },
  device: { status: DeviceStatus; dockId: string | null } | null,
): DeviceCheck {
  if (!requiresAuthorizedDevice(user.role)) return "ALLOWED";
  if (!device) return "UNKNOWN";
  if (device.status === "PENDING") return "PENDING";
  if (device.status === "REVOKED") return "REVOKED";
  if (user.role === "ADMIN" && device.dockId !== user.dockId) return "WRONG_DOCK";
  return "ALLOWED";
}

/** Nombre visible de la computadora (`authorized_devices.name`). */
export const DEVICE_NAME_MAX_LENGTH = 60;

export const DEVICE_STATUSES: readonly DeviceStatus[] = ["PENDING", "APPROVED", "REVOKED"];

/** Solo se aprueba una solicitud pendiente (RF-121). */
export function canApproveDevice(status: DeviceStatus): boolean {
  return status === "PENDING";
}

/** Se revoca una solicitud pendiente (rechazarla) o una computadora aprobada (RF-121). */
export function canRevokeDevice(status: DeviceStatus): boolean {
  return status === "PENDING" || status === "APPROVED";
}

/**
 * Muelle con el que se aprueba la computadora. La de un administrador debe ser **de su
 * muelle** (si no, `checkDevice` lo rechazaría por WRONG_DOCK al entrar); la del
 * superadministrador puede ser de cualquier muelle o de oficina (sin muelle).
 */
export function isValidDeviceDock(
  requester: { role: Role; dockId: string | null },
  dockId: string | null,
): boolean {
  if (requester.role !== "ADMIN") return true;
  return dockId !== null && dockId === requester.dockId;
}
