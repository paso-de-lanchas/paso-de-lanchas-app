/**
 * Puertos (interfaces) que los casos de uso necesitan del mundo exterior.
 * La capa de infraestructura los implementa (Prisma, Mercado Pago, correo…) y las
 * pruebas usan versiones falsas. Así los casos de uso no dependen de ninguna librería.
 *
 * Cada módulo agrega aquí (o en src/application/<modulo>/ports.ts) los que necesite,
 * por ejemplo: WalletRepository, DepartureRepository, PaymentGateway, Mailer.
 */

/** Reloj inyectable: en pruebas se fija la hora para que el QR TOTP sea predecible. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Una acción para la bitácora de auditoría (RF-122 a RF-124). */
export interface AuditEntry {
  userId: string | null;
  deviceId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/** Registra una acción en la bitácora de auditoría (RF-122 a RF-124). */
export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}

/**
 * Evento de bitácora que un repositorio guarda en la misma transacción que el cambio, para
 * que nunca quede un cambio sin registro. El repositorio completa `entity` y `entityId`.
 */
export type ChangeAudit = Pick<AuditEntry, "userId" | "action" | "details">;
