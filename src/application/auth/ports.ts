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
}

export interface SessionRepository {
  create(session: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Sesión y su usuario, o null si no existe. */
  findByTokenHash(tokenHash: string): Promise<{
    expiresAt: Date;
    user: CurrentUser & { status: AccountStatus };
  } | null>;
  deleteByTokenHash(tokenHash: string): Promise<{ userId: string } | null>;
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
