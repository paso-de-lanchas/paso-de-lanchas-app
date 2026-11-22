import type { SessionRepository, UserCredentialsRepository } from "@/application/auth/ports";
import type { PrismaClient } from "@/generated/prisma/client";

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
        select: { ...currentUserFields, passwordHash: true },
      }),
  };
}

export function prismaSessionRepository(db: PrismaClient): SessionRepository {
  return {
    async create({ userId, tokenHash, expiresAt }) {
      await db.session.create({ data: { userId, sessionToken: tokenHash, expiresAt } });
    },
    async findByTokenHash(tokenHash) {
      const session = await db.session.findUnique({
        where: { sessionToken: tokenHash },
        select: { expiresAt: true, user: { select: { ...currentUserFields, deletedAt: true } } },
      });
      if (!session) return null;
      const { deletedAt, ...user } = session.user;
      // Una cuenta eliminada se trata como inactiva: getCurrentUser borra la sesión.
      return {
        expiresAt: session.expiresAt,
        user: deletedAt ? { ...user, status: "INACTIVE" } : user,
      };
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
