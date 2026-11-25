import type { DeviceStatus } from "@/domain/auth/authorized-device";
import type { Role } from "@/domain/auth/roles";

import type { ChangeAudit } from "../shared/ports";
import type { DockOption } from "../staff/ports";

/** Puertos de la administración de computadoras del muelle (RF-120, RF-121). */

export interface DeviceView {
  id: string;
  name: string;
  status: DeviceStatus;
  dockId: string | null;
  dockName: string | null;
  requestedBy: { fullName: string; email: string; role: Role; dockId: string | null };
  requestedAt: Date;
  approvedByName: string | null;
  approvedAt: Date | null;
  lastSeenAt: Date | null;
}

export interface DeviceAdminRepository {
  /** Las computadoras en ese estado, las más recientes primero. */
  list(status: DeviceStatus): Promise<DeviceView[]>;
  findById(id: string): Promise<DeviceView | null>;
  listDocks(): Promise<DockOption[]>;
  dockExists(dockId: string): Promise<boolean>;
  /*
   * Cada cambio recibe su evento de bitácora y lo guarda en la misma transacción (entidad
   * "authorized_device", id de la computadora): o quedan las dos cosas o ninguna.
   */
  /** Aprueba solo si sigue PENDING (false si otra petición la cambió antes). */
  approve(
    id: string,
    data: { name: string; dockId: string | null; approvedById: string; at: Date },
    audit: ChangeAudit,
  ): Promise<boolean>;
  /**
   * Pasa a REVOKED si estaba PENDING o APPROVED y, en la misma transacción, borra las sesiones
   * abiertas desde ella. Devuelve false si ya estaba revocada.
   */
  revoke(id: string, audit: ChangeAudit): Promise<boolean>;
  /** Cambia el nombre de una computadora que no esté revocada. */
  rename(id: string, name: string, audit: ChangeAudit): Promise<boolean>;
}
