/**
 * Recuperar y cambiar contraseña contra la base de pruebas (issue #8).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { prismaPasswordRepository } from "@/infrastructure/auth/prisma-password-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio de contraseñas", () => {
  const db = prisma!;
  const email = `contrasena-${Date.now().toString(36)}@pasolanchas.test`;
  const later = new Date(Date.now() + 30 * 60 * 1000);
  let userId = "";

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email,
        fullName: "Chofer de prueba",
        passwordHash: "vieja",
        role: "DRIVER",
        status: "ACTIVE",
        mustChangePassword: true,
        failedLoginAttempts: 3,
        lockedUntil: later,
        sessions: {
          create: [
            { sessionToken: `s1-${email}`, expiresAt: later },
            { sessionToken: `s2-${email}`, expiresAt: later },
          ],
        },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("cambiar la contraseña conserva solo la sesión en uso", async () => {
    const passwords = prismaPasswordRepository(db);
    await passwords.changePassword(userId, "nueva", `s1-${email}`);

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sessions: true },
    });
    expect(user).toMatchObject({ passwordHash: "nueva", mustChangePassword: false });
    expect(user.sessions.map((s) => s.sessionToken)).toEqual([`s1-${email}`]);
  });

  it("el enlace se usa una sola vez aunque llegue dos veces a la vez, e invalida los demás", async () => {
    const passwords = prismaPasswordRepository(db);
    await passwords.addResetToken({ userId, tokenHash: `r1-${email}`, expiresAt: later });
    await passwords.addResetToken({ userId, tokenHash: `r2-${email}`, expiresAt: later });
    expect(await passwords.countResetTokensExpiringAfter(userId, new Date())).toBe(2);
    expect(await passwords.countResetTokensExpiringAfter(userId, later)).toBe(0);

    const first = await db.authToken.findUniqueOrThrow({ where: { tokenHash: `r1-${email}` } });
    const now = new Date();
    const results = await Promise.all([
      passwords.resetWithToken(first.id, userId, "otra", now),
      passwords.resetWithToken(first.id, userId, "otra", now),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sessions: true, authTokens: true },
    });
    expect(user).toMatchObject({ passwordHash: "otra", failedLoginAttempts: 0, lockedUntil: null });
    expect(user.sessions).toHaveLength(0);
    expect(user.authTokens.every((t) => t.usedAt !== null)).toBe(true);
    await expect(passwords.findById(userId)).resolves.toEqual({
      email,
      fullName: "Chofer de prueba",
      passwordHash: "otra",
    });
  });
});
