/**
 * Versiones en memoria de los puertos de autenticación, solo para pruebas.
 */
import type { AuditLogger, Clock } from "../shared/ports";
import type {
  PasswordHasher,
  SessionRepository,
  TokenService,
  UserCredentials,
  UserCredentialsRepository,
} from "./ports";

export const fakeHasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (passwordHash, password) => passwordHash === `hash:${password}`,
};

export function fakeTokens(): TokenService {
  let counter = 0;
  return { generate: () => `token-${++counter}`, hash: (token) => `sha256:${token}` };
}

export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let current = new Date(iso);
  return { now: () => current, set: (value) => (current = new Date(value)) };
}

export function memoryAudit(): AuditLogger & { entries: Parameters<AuditLogger["log"]>[0][] } {
  const entries: Parameters<AuditLogger["log"]>[0][] = [];
  return { entries, log: async (entry) => void entries.push(entry) };
}

export function memoryUsers(users: UserCredentials[]): UserCredentialsRepository {
  return { findByEmail: async (email) => users.find((u) => u.email === email) ?? null };
}

export function memorySessions(users: UserCredentials[]) {
  const rows = new Map<string, { userId: string; expiresAt: Date }>();
  const repo: SessionRepository = {
    create: async ({ userId, tokenHash, expiresAt }) =>
      void rows.set(tokenHash, { userId, expiresAt }),
    findByTokenHash: async (tokenHash) => {
      const row = rows.get(tokenHash);
      const user = row && users.find((u) => u.id === row.userId);
      if (!row || !user) return null;
      const { id, email, fullName, role, status, mustChangePassword } = user;
      return {
        expiresAt: row.expiresAt,
        user: { id, email, fullName, role, status, mustChangePassword },
      };
    },
    deleteByTokenHash: async (tokenHash) => {
      const row = rows.get(tokenHash);
      rows.delete(tokenHash);
      return row ? { userId: row.userId } : null;
    },
  };
  return Object.assign(repo, { rows });
}

export function makeUser(overrides: Partial<UserCredentials> = {}): UserCredentials {
  return {
    id: "u-1",
    email: "pasajero@pasolanchas.test",
    fullName: "Pasajero de prueba",
    role: "PASSENGER",
    status: "ACTIVE",
    passwordHash: "hash:secreta-123",
    mustChangePassword: false,
    ...overrides,
  };
}
