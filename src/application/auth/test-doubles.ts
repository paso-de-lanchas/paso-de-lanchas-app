/**
 * Versiones en memoria de los puertos de autenticación, solo para pruebas.
 */
import type { AuditLogger, Clock } from "../shared/ports";
import type {
  AuthorizedDeviceRecord,
  AuthorizedDeviceRepository,
  AuthSettings,
  AuthSettingsProvider,
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

export function memorySettings(overrides: Partial<AuthSettings> = {}): AuthSettingsProvider {
  return {
    get: async () => ({
      maxFailedLogins: 5,
      lockoutMinutes: 15,
      staffIdleMinutes: 30,
      ...overrides,
    }),
  };
}

/** Repositorio de usuarios que modifica los objetos de `users` (para revisar el contador). */
export function memoryUsers(users: UserCredentials[]): UserCredentialsRepository {
  const byId = (id: string) => users.find((u) => u.id === id)!;
  return {
    findByEmail: async (email) => {
      const user = users.find((u) => u.email === email);
      return user ? { ...user } : null;
    },
    recordFailedLogin: async (id) => ++byId(id).failedLoginAttempts,
    lock: async (id, until) => {
      Object.assign(byId(id), { lockedUntil: until, failedLoginAttempts: 0 });
    },
    clearFailedLogins: async (id) => {
      Object.assign(byId(id), { lockedUntil: null, failedLoginAttempts: 0 });
    },
  };
}

interface SessionRow {
  userId: string;
  expiresAt: Date;
  lastActivityAt: Date;
  deviceId: string | null;
}

export function memorySessions(
  users: UserCredentials[],
  devices: AuthorizedDeviceRecord[] = [],
  clock: Clock = fixedClock("2026-11-22T12:00:00Z"),
) {
  const rows = new Map<string, SessionRow>();
  const repo: SessionRepository = {
    create: async ({ userId, tokenHash, expiresAt, deviceId }) =>
      void rows.set(tokenHash, { userId, expiresAt, deviceId, lastActivityAt: clock.now() }),
    findByTokenHash: async (tokenHash) => {
      const row = rows.get(tokenHash);
      const user = row && users.find((u) => u.id === row.userId);
      if (!row || !user) return null;
      const { id, email, fullName, role, status, mustChangePassword } = user;
      return {
        expiresAt: row.expiresAt,
        lastActivityAt: row.lastActivityAt,
        deviceStatus: devices.find((d) => d.id === row.deviceId)?.status ?? null,
        user: { id, email, fullName, role, status, mustChangePassword },
      };
    },
    recordActivity: async (tokenHash, at) => {
      const row = rows.get(tokenHash);
      if (row) row.lastActivityAt = at;
    },
    deleteByTokenHash: async (tokenHash) => {
      const row = rows.get(tokenHash);
      rows.delete(tokenHash);
      return row ? { userId: row.userId } : null;
    },
  };
  return Object.assign(repo, { rows });
}

export function memoryDevices(devices: (AuthorizedDeviceRecord & { tokenHash: string })[] = []) {
  const repo: AuthorizedDeviceRepository = {
    findByTokenHash: async (tokenHash) => {
      const device = devices.find((d) => d.tokenHash === tokenHash);
      return device ? { id: device.id, dockId: device.dockId, status: device.status } : null;
    },
    requestApproval: async ({ tokenHash, dockId }) => {
      const device = {
        id: `d-${devices.length + 1}`,
        tokenHash,
        dockId,
        status: "PENDING" as const,
      };
      devices.push(device);
      return { id: device.id, dockId, status: device.status };
    },
    markSeen: async () => {},
  };
  return Object.assign(repo, { devices });
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
    dockId: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}
