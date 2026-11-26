/**
 * Registro de pasajero y verificación de correo contra la base de pruebas (issue #6).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  prismaEmailTokenRepository,
  prismaPassengerRegistrationRepository,
} from "@/infrastructure/auth/prisma-registration-repositories";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorios de registro", () => {
  const db = prisma!;
  const email = `registro-${Date.now().toString(36)}@pasolanchas.test`;
  const data = {
    email,
    fullName: "Pasajera de prueba",
    phone: "9211234567",
    passwordHash: "argon2-de-prueba",
    privacyAcceptedAt: new Date("2026-11-22T12:00:00Z"),
    verificationTokenHash: `hash-${email}`,
    verificationExpiresAt: new Date("2030-01-01T00:00:00Z"),
  };

  afterAll(async () => {
    // El monedero no se borra en cascada (protege el dinero): primero él, luego el usuario.
    await db.wallet.deleteMany({ where: { user: { email } } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("crea pasajero pendiente, monedero en $0 y enlace en una sola operación", async () => {
    const accounts = prismaPassengerRegistrationRepository(db);
    const created = await accounts.createPassenger(data);
    expect(created).not.toBeNull();

    const user = await db.user.findUniqueOrThrow({
      where: { email },
      include: { wallet: true, authTokens: true },
    });
    expect(user).toMatchObject({ role: "PASSENGER", status: "PENDING_VERIFICATION" });
    expect(user.wallet?.balance.toString()).toBe("0");
    expect(user.authTokens).toMatchObject([
      { purpose: "EMAIL_VERIFICATION", tokenHash: `hash-${email}`, usedAt: null },
    ]);

    // Mismo correo otra vez: no truena, devuelve null.
    expect(await accounts.createPassenger({ ...data, verificationTokenHash: "otro" })).toBeNull();
  });

  it("el enlace activa la cuenta una sola vez aunque se use dos veces al mismo tiempo", async () => {
    const tokens = prismaEmailTokenRepository(db);
    const token = await tokens.findByHash(`hash-${email}`, "EMAIL_VERIFICATION");
    expect(token).not.toBeNull();

    const now = new Date();
    const results = await Promise.all([
      tokens.consumeAndVerifyEmail(token!.id, token!.userId, now),
      tokens.consumeAndVerifyEmail(token!.id, token!.userId, now),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerifiedAt).not.toBeNull();
  });
});
