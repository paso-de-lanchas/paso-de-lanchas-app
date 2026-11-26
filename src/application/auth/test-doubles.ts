/**
 * Versiones en memoria de los puertos de autenticación, solo para pruebas.
 */
import type { AuditLogger, Clock } from "../shared/ports";
import type {
  AuthorizedDeviceRecord,
  AuthorizedDeviceRepository,
  AuthSettings,
  AuthSettingsProvider,
  EmailMessage,
  EmailTokenPurpose,
  EmailTokenRepository,
  Mailer,
  PassengerRegistrationRepository,
  PasswordHasher,
  PasswordRepository,
  SessionRepository,
  TokenService,
  UserCredentials,
  UserCredentialsRepository,
} from "./ports";

export function memoryMailer(): Mailer & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return { sent, send: async (message) => void sent.push(message) };
}

export interface MemoryAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  passwordHash: string;
  status: UserCredentials["status"];
  emailVerifiedAt: Date | null;
  walletBalance: string | null;
  mustChangePassword?: boolean;
  lockedUntil?: Date | null;
}

export interface MemoryEmailToken {
  id: string;
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Cuentas, monederos, tokens por correo y sesiones en memoria (registro, verificación y
 * contraseñas). `sessions` solo guarda de quién es cada sesión, para revisar cuáles se cierran.
 */
export function memoryAccounts(
  accounts: MemoryAccount[] = [],
  tokens: MemoryEmailToken[] = [],
  sessions: { userId: string; tokenHash: string }[] = [],
) {
  const addToken = (token: Omit<MemoryEmailToken, "id" | "usedAt">) =>
    void tokens.push({ ...token, id: `t-${tokens.length + 1}`, usedAt: null });
  const byId = (id: string) => accounts.find((a) => a.id === id);
  const keepSessions = (keep: (s: { userId: string; tokenHash: string }) => boolean) =>
    sessions.splice(0, sessions.length, ...sessions.filter(keep));

  const registration: PassengerRegistrationRepository = {
    findAccountByEmail: async (email) => {
      const account = accounts.find((a) => a.email === email);
      return account
        ? { id: account.id, fullName: account.fullName, status: account.status }
        : null;
    },
    createPassenger: async (data) => {
      if (accounts.some((a) => a.email === data.email)) return null;
      const id = `u-${accounts.length + 1}`;
      accounts.push({
        id,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        passwordHash: data.passwordHash,
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
        walletBalance: "0.00",
      });
      addToken({
        userId: id,
        purpose: "EMAIL_VERIFICATION",
        tokenHash: data.verificationTokenHash,
        expiresAt: data.verificationExpiresAt,
      });
      return { id };
    },
    addEmailToken: async (token) => addToken(token),
  };

  const emailTokens: EmailTokenRepository = {
    findByHash: async (tokenHash, purpose) => {
      const token = tokens.find((t) => t.tokenHash === tokenHash && t.purpose === purpose);
      return token
        ? { id: token.id, userId: token.userId, expiresAt: token.expiresAt, usedAt: token.usedAt }
        : null;
    },
    consumeAndVerifyEmail: async (tokenId, userId, at) => {
      const token = tokens.find((t) => t.id === tokenId);
      if (!token || token.usedAt) return false;
      token.usedAt = at;
      const account = accounts.find((a) => a.id === userId);
      if (account?.status === "PENDING_VERIFICATION") {
        Object.assign(account, { status: "ACTIVE", emailVerifiedAt: at });
      }
      return true;
    },
  };

  const passwords: PasswordRepository = {
    findAccountByEmail: registration.findAccountByEmail,
    countResetTokensExpiringAfter: async (userId, at) =>
      tokens.filter(
        (t) =>
          t.userId === userId &&
          t.purpose === "PASSWORD_RESET" &&
          t.expiresAt.getTime() > at.getTime(),
      ).length,
    addResetToken: async (token) => addToken({ ...token, purpose: "PASSWORD_RESET" }),
    findById: async (userId) => {
      const account = byId(userId);
      return account
        ? { email: account.email, fullName: account.fullName, passwordHash: account.passwordHash }
        : null;
    },
    resetWithToken: async (tokenId, userId, passwordHash, at) => {
      const token = tokens.find((t) => t.id === tokenId);
      if (!token || token.usedAt) return false;
      for (const t of tokens) {
        if (t.userId === userId && t.purpose === "PASSWORD_RESET" && !t.usedAt) t.usedAt = at;
      }
      Object.assign(byId(userId)!, { passwordHash, lockedUntil: null, mustChangePassword: false });
      keepSessions((s) => s.userId !== userId);
      return true;
    },
    changePassword: async (userId, passwordHash, keepSessionTokenHash) => {
      Object.assign(byId(userId)!, { passwordHash, mustChangePassword: false });
      keepSessions((s) => s.userId !== userId || s.tokenHash === keepSessionTokenHash);
    },
  };

  return { accounts, tokens, sessions, registration, emailTokens, passwords };
}

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
