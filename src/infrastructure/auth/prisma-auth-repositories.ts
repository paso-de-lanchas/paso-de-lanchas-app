import type {
  AuthorizedDeviceRepository,
  SessionRepository,
  UserCredentialsRepository,
} from "@/application/auth/ports";
import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/infrastructure/db/prisma-errors";

const currentUserFields = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  mustChangePassword: true,
} as const;

export function prismaUserCredentialsRepository(db: PrismaClient): UserCredentialsRepository {
  return {
    findByEmail: (email) =>
      db.user.findFirst({
        where: { email, deletedAt: null },
        select: {
          ...currentUserFields,
          passwordHash: true,
          dockId: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      }),
    async recordFailedLogin(userId) {
      // increment es atómico: dos intentos al mismo tiempo no se pierden.
      const { failedLoginAttempts } = await db.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      return failedLoginAttempts;
    },
    async lock(userId, until) {
      await db.user.update({
        where: { id: userId },
        data: { lockedUntil: until, failedLoginAttempts: 0 },
      });
    },
    async clearFailedLogins(userId) {
      await db.user.update({
        where: { id: userId },
        data: { lockedUntil: null, failedLoginAttempts: 0 },
      });
    },
  };
}

export function prismaSessionRepository(db: PrismaClient): SessionRepository {
  return {
    async create({ userId, tokenHash, expiresAt, deviceId }) {
      await db.session.create({ data: { userId, sessionToken: tokenHash, expiresAt, deviceId } });
    },
    async findByTokenHash(tokenHash) {
      const session = await db.session.findUnique({
        where: { sessionToken: tokenHash },
        select: {
          expiresAt: true,
          lastActivityAt: true,
          device: { select: { status: true } },
          user: { select: { ...currentUserFields, deletedAt: true } },
        },
      });
      if (!session) return null;
      const { deletedAt, ...user } = session.user;
      return {
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        deviceStatus: session.device?.status ?? null,
        // Una cuenta eliminada se trata como inactiva: getCurrentUser borra la sesión.
        user: deletedAt ? { ...user, status: "INACTIVE" } : user,
      };
    },
    async recordActivity(tokenHash, at) {
      await db.session.updateMany({
        where: { sessionToken: tokenHash },
        data: { lastActivityAt: at },
      });
    },
    async deleteByTokenHash(tokenHash) {
      // deleteMany no falla si otra petición ya la borró (doble clic en "Cerrar sesión").
      const session = await db.session.findUnique({
        where: { sessionToken: tokenHash },
        select: { userId: true },
      });
      if (!session) return null;
      const { count } = await db.session.deleteMany({ where: { sessionToken: tokenHash } });
      return count > 0 ? session : null;
    },
  };
}

const deviceFields = { id: true, dockId: true, status: true } as const;

export function prismaAuthorizedDeviceRepository(db: PrismaClient): AuthorizedDeviceRepository {
  return {
    findByTokenHash: (tokenHash) =>
      db.authorizedDevice.findUnique({
        where: { deviceTokenHash: tokenHash },
        select: deviceFields,
      }),
    async requestApproval({ tokenHash, dockId, name, requestedById }) {
      try {
        return await db.authorizedDevice.create({
          data: { deviceTokenHash: tokenHash, dockId, name, requestedById },
          select: deviceFields,
        });
      } catch (error) {
        // Dos intentos al mismo tiempo con el mismo token: el índice único deja crear solo uno.
        if (!isUniqueViolation(error)) throw error;
        return db.authorizedDevice.findUniqueOrThrow({
          where: { deviceTokenHash: tokenHash },
          select: deviceFields,
        });
      }
    },
    async markSeen(deviceId, at) {
      await db.authorizedDevice.update({ where: { id: deviceId }, data: { lastSeenAt: at } });
    },
  };
}
