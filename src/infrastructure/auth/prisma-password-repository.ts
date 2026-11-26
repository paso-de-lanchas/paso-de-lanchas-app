import type { PasswordRepository } from "@/application/auth/ports";
import type { PrismaClient } from "@/generated/prisma/client";

export function prismaPasswordRepository(db: PrismaClient): PasswordRepository {
  return {
    findAccountByEmail: (email) =>
      db.user.findFirst({
        where: { email, deletedAt: null },
        select: { id: true, fullName: true, status: true },
      }),
    countResetTokensExpiringAfter: (userId, at) =>
      db.authToken.count({ where: { userId, purpose: "PASSWORD_RESET", expiresAt: { gt: at } } }),
    async addResetToken({ userId, tokenHash, expiresAt }) {
      await db.authToken.create({
        data: { userId, purpose: "PASSWORD_RESET", tokenHash, expiresAt },
      });
    },
    findById: (userId) =>
      db.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { email: true, fullName: true, passwordHash: true },
      }),
    resetWithToken: (tokenId, userId, passwordHash, at) =>
      db.$transaction(async (tx) => {
        // Condición usedAt = null: si el enlace se usa dos veces a la vez, solo una gana.
        const { count } = await tx.authToken.updateMany({
          where: { id: tokenId, usedAt: null },
          data: { usedAt: at },
        });
        if (count === 0) return false;
        // Los demás enlaces de recuperación pendientes ya no sirven.
        await tx.authToken.updateMany({
          where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
          data: { usedAt: at },
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash,
            mustChangePassword: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        // Quien tenga la contraseña vieja pierde el acceso: se cierran todas las sesiones.
        await tx.session.deleteMany({ where: { userId } });
        return true;
      }),
    async changePassword(userId, passwordHash, keepSessionTokenHash) {
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { passwordHash, mustChangePassword: false },
        }),
        db.session.deleteMany({
          where: { userId, sessionToken: { not: keepSessionTokenHash } },
        }),
      ]);
    },
  };
}
