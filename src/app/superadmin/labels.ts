import type { AccountStatusCode, StaffRole } from "@/domain/staff/staff-rules";

/** Textos de las pantallas del superadministrador. */

export const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  DRIVER: "Chofer",
};

export const STATUS_LABEL: Record<AccountStatusCode, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Desactivada",
  BLOCKED: "Bloqueada",
  PENDING_VERIFICATION: "Sin confirmar",
};

export const STATUS_STYLE: Record<AccountStatusCode, string> = {
  ACTIVE: "bg-success-bg text-success-ink",
  INACTIVE: "bg-slate-200 text-slate-800",
  BLOCKED: "bg-red-100 text-red-900",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-900",
};

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/** Fecha y hora en la zona del muelle (las dos ciudades están en la hora del centro). */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}
