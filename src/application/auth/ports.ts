import type { DeviceStatus } from "@/domain/auth/authorized-device";
import type { Role } from "@/domain/auth/roles";

/**
 * Puertos del módulo de autenticación. La infraestructura los implementa con Prisma,
 * Argon2 y `crypto`; las pruebas usan versiones en memoria.
 */

export type AccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "BLOCKED" | "INACTIVE";

/** Lo mínimo del usuario que necesita el login (incluye el hash: nunca sale de esta capa). */
export interface UserCredentials {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  passwordHash: string;
  mustChangePassword: boolean;
  dockId: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/** Usuario con sesión, seguro para pasar a las pantallas (sin hash ni datos sensibles). */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface UserCredentialsRepository {
  /** Busca por correo ya normalizado. No devuelve cuentas eliminadas. */
  findByEmail(email: string): Promise<UserCredentials | null>;
  /** Suma un intento fallido de forma atómica y devuelve el total. */
  recordFailedLogin(userId: string): Promise<number>;
  /** Bloquea hasta `until` y reinicia el contador. */
  lock(userId: string, until: Date): Promise<void>;
  /** Tras un acierto: contador en 0 y sin bloqueo. */
  clearFailedLogins(userId: string): Promise<void>;
}

export interface SessionRecord {
  expiresAt: Date;
  lastActivityAt: Date;
  /** Estado de la computadora con la que se inició la sesión (null si no se usó una). */
  deviceStatus: DeviceStatus | null;
  user: CurrentUser & { status: AccountStatus };
}

export interface SessionRepository {
  create(session: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    deviceId: string | null;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  recordActivity(tokenHash: string, at: Date): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<{ userId: string } | null>;
}

export interface AuthorizedDeviceRecord {
  id: string;
  dockId: string | null;
  status: DeviceStatus;
}

export interface AuthorizedDeviceRepository {
  findByTokenHash(tokenHash: string): Promise<AuthorizedDeviceRecord | null>;
  /** Crea la solicitud en PENDING. */
  requestApproval(request: {
    tokenHash: string;
    dockId: string | null;
    name: string;
    requestedById: string;
  }): Promise<AuthorizedDeviceRecord>;
  markSeen(deviceId: string, at: Date): Promise<void>;
}

/** Reglas configurables de `system_settings`, con valores por defecto si no existen. */
export interface AuthSettings {
  maxFailedLogins: number;
  lockoutMinutes: number;
  staffIdleMinutes: number;
}

export interface AuthSettingsProvider {
  get(): Promise<AuthSettings>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

/** Genera tokens aleatorios y su hash (en la base solo se guarda el hash). */
export interface TokenService {
  generate(): string;
  hash(token: string): string;
}
