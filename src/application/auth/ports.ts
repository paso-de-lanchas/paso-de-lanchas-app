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

export type EmailTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

/** Cuenta ya registrada con un correo (sin datos sensibles). */
export interface ExistingAccount {
  id: string;
  fullName: string;
  status: AccountStatus;
}

export interface PassengerRegistrationRepository {
  findAccountByEmail(email: string): Promise<ExistingAccount | null>;
  /**
   * Crea, en una sola transacción, el pasajero en PENDING_VERIFICATION, su monedero en $0 y
   * su token de verificación. Devuelve null si el correo ya estaba registrado.
   */
  createPassenger(data: {
    email: string;
    fullName: string;
    phone: string;
    passwordHash: string;
    privacyAcceptedAt: Date;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }): Promise<{ id: string } | null>;
  addEmailToken(token: {
    userId: string;
    purpose: EmailTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface EmailTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface EmailTokenRepository {
  findByHash(tokenHash: string, purpose: EmailTokenPurpose): Promise<EmailTokenRecord | null>;
  /**
   * Marca el token como usado y activa la cuenta (si estaba pendiente), en una transacción.
   * Devuelve false si otra petición lo usó primero.
   */
  consumeAndVerifyEmail(tokenId: string, userId: string, at: Date): Promise<boolean>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/** Recuperar y cambiar contraseña (RF-005, RF-006, RF-013). */
export interface PasswordRepository {
  /** Cuenta con ese correo (ya normalizado), sin las eliminadas. */
  findAccountByEmail(email: string): Promise<ExistingAccount | null>;
  /**
   * Enlaces de recuperación de la cuenta (usados o no) que vencen después de `at`. Como todos
   * duran lo mismo, son los que se crearon en los últimos 30 minutos.
   */
  countResetTokensExpiringAfter(userId: string, at: Date): Promise<number>;
  addResetToken(token: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Datos para verificar la contraseña actual y avisar del cambio por correo. */
  findById(
    userId: string,
  ): Promise<{ email: string; fullName: string; passwordHash: string } | null>;
  /**
   * En una transacción: marca el enlace como usado (false si otra petición lo usó primero),
   * invalida los demás enlaces de recuperación, guarda la nueva contraseña (ya no temporal), quita el bloqueo
   * por intentos y borra TODAS las sesiones de la cuenta.
   */
  resetWithToken(tokenId: string, userId: string, passwordHash: string, at: Date): Promise<boolean>;
  /**
   * En una transacción: guarda la nueva contraseña, quita `must_change_password` y borra las
   * demás sesiones (conserva la de `keepSessionTokenHash`).
   */
  changePassword(userId: string, passwordHash: string, keepSessionTokenHash: string): Promise<void>;
}
