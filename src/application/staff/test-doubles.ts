/**
 * Repositorio del personal en memoria, solo para pruebas. Guarda también superadmins y
 * pasajeros para comprobar que nunca se pueden administrar desde aquí.
 */
import type { Role } from "@/domain/auth/roles";
import { isStaffRole } from "@/domain/staff/staff-rules";

import type { AuditLogger, ChangeAudit } from "../shared/ports";
import type { DockOption, StaffAccount, StaffRepository } from "./ports";

export interface MemoryStaffUser extends Omit<StaffAccount, "role"> {
  role: Role;
  passwordHash: string;
  sessions: number;
  resetTokens: number;
}

export const DOCKS: DockOption[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Coatzacoalcos" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Villa Allende" },
];

let nextId = 100;
export function memoryStaffUser(overrides: Partial<MemoryStaffUser> = {}): MemoryStaffUser {
  nextId += 1;
  return {
    id: `00000000-0000-4000-8000-000000000${nextId}`,
    email: `persona${nextId}@pasolanchas.test`,
    fullName: "Persona de prueba",
    phone: "9211234567",
    role: "DRIVER",
    status: "ACTIVE",
    dockId: null,
    dockName: null,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date("2026-11-01T12:00:00Z"),
    passwordHash: "hash:anterior-2026",
    sessions: 2,
    resetTokens: 1,
    ...overrides,
  };
}

function toAccount(user: MemoryStaffUser): StaffAccount | null {
  if (!isStaffRole(user.role)) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    dockId: user.dockId,
    dockName: user.dockName,
    mustChangePassword: user.mustChangePassword,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
  };
}

/**
 * `audit` recibe los eventos que el repositorio real guarda en la misma transacción que el
 * cambio (solo cuando el cambio sí se aplica).
 */
export function memoryStaff(
  users: MemoryStaffUser[] = [],
  audit?: AuditLogger,
): StaffRepository & {
  users: MemoryStaffUser[];
} {
  const byId = (id: string) => users.find((u) => u.id === id);
  const record = (id: string, entry: ChangeAudit) =>
    audit?.log({ ...entry, entity: "user", entityId: id });
  return {
    users,
    list: async (filter) =>
      users
        .map(toAccount)
        .filter((a): a is StaffAccount => a !== null)
        .filter(
          (a) =>
            (!filter.role || a.role === filter.role) &&
            (!filter.status || a.status === filter.status),
        ),
    findStaff: async (id) => {
      const user = byId(id);
      return user ? toAccount(user) : null;
    },
    listDocks: async () => DOCKS,
    dockExists: async (id) => DOCKS.some((d) => d.id === id),
    create: async (account, entry) => {
      if (users.some((u) => u.email === account.email)) return null;
      const user = memoryStaffUser({
        ...account,
        dockName: DOCKS.find((d) => d.id === account.dockId)?.name ?? null,
        mustChangePassword: true,
        sessions: 0,
        resetTokens: 0,
      });
      users.push(user);
      await record(user.id, entry);
      return { id: user.id };
    },
    setStatus: async (id, from, to, entry) => {
      const user = byId(id);
      if (!user || !from.includes(user.status)) return false;
      user.status = to;
      if (to === "INACTIVE") user.sessions = 0;
      await record(id, entry);
      return true;
    },
    unlock: async (id, entry) => {
      const user = byId(id);
      if (!user) return false;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await record(id, entry);
      return true;
    },
    resetPassword: async (id, passwordHash, entry) => {
      const user = byId(id);
      if (!user) return false;
      await record(id, entry);
      Object.assign(user, {
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessions: 0,
        resetTokens: 0,
      });
      return true;
    },
  };
}
