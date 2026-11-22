/**
 * Repositorios de autenticación contra la base de pruebas (issue #9).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  prismaAuthorizedDeviceRepository,
  prismaUserCredentialsRepository,
} from "@/infrastructure/auth/prisma-auth-repositories";
import { prismaAuthSettings } from "@/infrastructure/auth/prisma-auth-settings";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorios de autenticación", () => {
  const db = prisma!;
  const suffix = Date.now().toString(36);
  let userId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `admin-${suffix}@pasolanchas.test`,
        fullName: "Admin de prueba",
        passwordHash: "x",
        role: "SUPERADMIN",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.authorizedDevice.deleteMany({ where: { requestedById: userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("cuenta los intentos fallidos sin perder ninguno aunque lleguen al mismo tiempo", async () => {
    const users = prismaUserCredentialsRepository(db);
    await Promise.all(Array.from({ length: 5 }, () => users.recordFailedLogin(userId)));
    expect((await users.findByEmail(`admin-${suffix}@pasolanchas.test`))?.failedLoginAttempts).toBe(
      5,
    );

    await users.lock(userId, new Date("2030-01-01T00:00:00Z"));
    let user = await users.findByEmail(`admin-${suffix}@pasolanchas.test`);
    expect(user).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: new Date("2030-01-01T00:00:00Z"),
    });

    await users.clearFailedLogins(userId);
    user = await users.findByEmail(`admin-${suffix}@pasolanchas.test`);
    expect(user).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null });
  });

  it("crea una sola solicitud de computadora aunque se pida dos veces, también sin muelle", async () => {
    const devices = prismaAuthorizedDeviceRepository(db);
    const request = {
      tokenHash: `hash-${suffix}`,
      dockId: null,
      name: "Oficina",
      requestedById: userId,
    };
    const [a, b] = await Promise.all([
      devices.requestApproval(request),
      devices.requestApproval(request),
    ]);
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ dockId: null, status: "PENDING" });
    expect(await devices.findByTokenHash(`hash-${suffix}`)).toEqual(a);
  });

  it("lee las reglas de system_settings o usa los valores por defecto", async () => {
    const settings = await prismaAuthSettings(db).get();
    expect(settings.maxFailedLogins).toBeGreaterThan(0);
    expect(settings.lockoutMinutes).toBeGreaterThan(0);
    expect(settings.staffIdleMinutes).toBeGreaterThan(0);
  });
});
