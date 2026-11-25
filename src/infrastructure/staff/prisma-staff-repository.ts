import type { ChangeAudit } from "@/application/shared/ports";
import type { StaffAccount, StaffRepository } from "@/application/staff/ports";
import type { PrismaClient } from "@/generated/prisma/client";
import { STAFF_ROLES, type StaffRole } from "@/domain/staff/staff-rules";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";
import { isUniqueViolation } from "@/infrastructure/db/prisma-errors";

const staffFields = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  dockId: true,
  mustChangePassword: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  createdAt: true,
  dock: { select: { name: true } },
} as const;

/** Solo administradores y choferes que no se han eliminado. */
const staffOnly = { role: { in: [...STAFF_ROLES] }, deletedAt: null };

function toAccount(row: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: StaffAccount["status"];
  dockId: string | null;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  dock: { name: string } | null;
}): StaffAccount {
  const { dock, ...account } = row;
  return { ...account, role: row.role as StaffRole, dockName: dock?.name ?? null };
}

/** El evento de bitácora de un cambio a la cuenta `id`, para guardarlo en su transacción. */
function auditFor(id: string, audit: ChangeAudit) {
  return { data: auditLogData({ ...audit, entity: "user", entityId: id }) };
}

/**
 * Cuentas del personal en `users` (RF-116 a RF-119). Cada cambio se guarda junto con su
 * evento de bitácora en una sola transacción: o quedan los dos o ninguno.
 */
export function prismaStaffRepository(db: PrismaClient): StaffRepository {
  return {
    async list({ role, status }) {
      const rows = await db.user.findMany({
        where: { ...staffOnly, ...(role ? { role } : {}), ...(status ? { status } : {}) },
        select: staffFields,
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      });
      return rows.map(toAccount);
    },
    async findStaff(id) {
      const row = await db.user.findFirst({ where: { id, ...staffOnly }, select: staffFields });
      return row ? toAccount(row) : null;
    },
    listDocks: () =>
      db.dock.findMany({ select: { id: true, name: true }, orderBy: { code: "asc" } }),
    async dockExists(dockId) {
      return (await db.dock.count({ where: { id: dockId } })) > 0;
    },
    async create({ email, fullName, phone, role, dockId, passwordHash, createdAt }, audit) {
      try {
        return await db.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              fullName,
              phone,
              role,
              dockId,
              passwordHash,
              status: "ACTIVE",
              mustChangePassword: true,
              // El superadministrador escribió el correo: no hace falta el enlace de verificación.
              emailVerifiedAt: createdAt,
            },
            select: { id: true },
          });
          await tx.auditLog.create(auditFor(created.id, audit));
          return created;
        });
      } catch (error) {
        // El correo ya lo usa otra cuenta (de cualquier rol): el índice único lo impide.
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    },
    setStatus: (id, from, to, audit) =>
      db.$transaction(async (tx) => {
        // Condición en el estado actual: dos superadmins a la vez no se pisan.
        const { count } = await tx.user.updateMany({
          where: { id, ...staffOnly, status: { in: [...from] } },
          data: { status: to },
        });
        if (count === 0) return false;
        // Una cuenta desactivada pierde el acceso al instante.
        if (to === "INACTIVE") await tx.session.deleteMany({ where: { userId: id } });
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
    unlock: (id, audit) =>
      db.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id, ...staffOnly },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        if (count === 0) return false;
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
    resetPassword: (id, passwordHash, audit) =>
      db.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id, ...staffOnly },
          data: {
            passwordHash,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        if (count === 0) return false;
        // Un enlace de recuperación pendiente ya no debe servir para saltarse la temporal.
        await tx.authToken.deleteMany({
          where: { userId: id, purpose: "PASSWORD_RESET", usedAt: null },
        });
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.auditLog.create(auditFor(id, audit));
        return true;
      }),
  };
}
