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
