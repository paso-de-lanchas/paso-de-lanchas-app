import type {
  EmailTokenRepository,
  PassengerRegistrationRepository,
} from "@/application/auth/ports";
import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/infrastructure/db/prisma-errors";

export function prismaPassengerRegistrationRepository(
  db: PrismaClient,
): PassengerRegistrationRepository {
  return {
    findAccountByEmail: (email) =>
      db.user.findFirst({
        where: { email, deletedAt: null },
        select: { id: true, fullName: true, status: true },
      }),
    async createPassenger(data) {
      try {
        // Un solo INSERT con escrituras anidadas: Prisma lo hace en una transacción, así que
        // nunca queda un usuario sin monedero o sin su enlace de verificación.
        return await db.user.create({
          data: {
            email: data.email,
            fullName: data.fullName,
            phone: data.phone,
            passwordHash: data.passwordHash,
            privacyAcceptedAt: data.privacyAcceptedAt,
            role: "PASSENGER", // RF-007: el registro público solo crea pasajeros.
            status: "PENDING_VERIFICATION",
            wallet: { create: {} },
            authTokens: {
              create: {
                purpose: "EMAIL_VERIFICATION",
                tokenHash: data.verificationTokenHash,
                expiresAt: data.verificationExpiresAt,
              },
            },
          },
          select: { id: true },
        });
      } catch (error) {
        // Dos registros al mismo tiempo con el mismo correo: el índice único deja pasar uno.
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    },
    async addEmailToken({ userId, purpose, tokenHash, expiresAt }) {
      await db.authToken.create({ data: { userId, purpose, tokenHash, expiresAt } });
    },
  };
}

export function prismaEmailTokenRepository(db: PrismaClient): EmailTokenRepository {
  return {
    findByHash: (tokenHash, purpose) =>
      db.authToken.findFirst({
        where: { tokenHash, purpose },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      }),
    consumeAndVerifyEmail: (tokenId, userId, at) =>
      db.$transaction(async (tx) => {
        // Condición usedAt = null: si dos peticiones usan el enlace a la vez, solo una gana.
        const { count } = await tx.authToken.updateMany({
          where: { id: tokenId, usedAt: null },
          data: { usedAt: at },
        });
        if (count === 0) return false;
        // Solo activa cuentas pendientes: no reactiva una cuenta bloqueada.
        await tx.user.updateMany({
          where: { id: userId, status: "PENDING_VERIFICATION" },
          data: { status: "ACTIVE", emailVerifiedAt: at },
        });
        return true;
      }),
  };
}
