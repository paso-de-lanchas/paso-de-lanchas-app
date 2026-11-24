/**
 * Cuentas del personal contra la base de pruebas (issue #41).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { prismaStaffRepository } from "@/infrastructure/staff/prisma-staff-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio del personal", () => {
  const db = prisma!;
  const repo = prismaStaffRepository(db);
  const tag = Date.now().toString(36);
  const later = new Date(Date.now() + 30 * 60 * 1000);
  let dockId = "";
  let superadminId = "";
  const created: string[] = [];

  beforeAll(async () => {
    const dock = await db.dock.create({
      data: {
        code: `T${tag}`.slice(0, 10),
        name: `Muelle ${tag}`,
        latitude: "18",
        longitude: "-94",
      },
    });
    dockId = dock.id;
    const superadmin = await db.user.create({
      data: {
        email: `super-${tag}@pasolanchas.test`,
        fullName: "Super de prueba",
        passwordHash: "x",
        role: "SUPERADMIN",
        status: "ACTIVE",
      },
    });
    superadminId = superadmin.id;
  });

  afterAll(async () => {
    await db.session.deleteMany({ where: { userId: { in: [...created, superadminId] } } });
    await db.authToken.deleteMany({ where: { userId: { in: created } } });
    await db.user.deleteMany({ where: { id: { in: [...created, superadminId] } } });
    await db.dock.deleteMany({ where: { id: dockId } });
    await db.$disconnect();
  });

  it("crea un administrador activo con su muelle y rechaza el correo repetido", async () => {
    const data = {
      email: `admin-${tag}@pasolanchas.test`,
      fullName: "Admin de prueba",
      phone: "9211234567",
      role: "ADMIN" as const,
      dockId,
      passwordHash: "hash-temporal",
      createdAt: new Date(),
    };
    const result = await repo.create(data);
    expect(result).not.toBeNull();
    created.push(result!.id);

    const account = await repo.findStaff(result!.id);
    expect(account).toMatchObject({
      role: "ADMIN",
      status: "ACTIVE",
      dockId,
      dockName: `Muelle ${tag}`,
      mustChangePassword: true,
    });
    expect(await repo.create({ ...data, fullName: "Otro" })).toBeNull();
    expect(await repo.dockExists(dockId)).toBe(true);
  });

  it("nunca devuelve ni modifica a un superadministrador", async () => {
    expect(await repo.findStaff(superadminId)).toBeNull();
    expect((await repo.list({})).some((a) => a.id === superadminId)).toBe(false);
    expect(await repo.setStatus(superadminId, ["ACTIVE"], "INACTIVE")).toBe(false);
    await repo.resetPassword(superadminId, "otro");
    const superadmin = await db.user.findUniqueOrThrow({ where: { id: superadminId } });
    expect(superadmin).toMatchObject({ status: "ACTIVE", passwordHash: "x" });
  });

  it("desactivar borra sus sesiones y solo cambia desde los estados permitidos", async () => {
    const driver = await db.user.create({
      data: {
        email: `chofer-${tag}@pasolanchas.test`,
        fullName: "Chofer de prueba",
        passwordHash: "vieja",
        role: "DRIVER",
        status: "ACTIVE",
        failedLoginAttempts: 4,
        lockedUntil: later,
        sessions: { create: [{ sessionToken: `s1-${tag}`, expiresAt: later }] },
        authTokens: {
          create: [{ tokenHash: `rt-${tag}`, purpose: "PASSWORD_RESET", expiresAt: later }],
        },
      },
    });
    created.push(driver.id);

    expect(await repo.setStatus(driver.id, ["INACTIVE"], "ACTIVE")).toBe(false);
    expect(await repo.setStatus(driver.id, ["ACTIVE", "BLOCKED"], "INACTIVE")).toBe(true);
    expect(await db.session.count({ where: { userId: driver.id } })).toBe(0);
    expect((await repo.list({ role: "DRIVER", status: "INACTIVE" })).map((a) => a.id)).toContain(
      driver.id,
    );

    await repo.unlock(driver.id);
    expect(await repo.findStaff(driver.id)).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it("restablecer guarda la temporal, obliga a cambiarla y cierra sesiones y enlaces", async () => {
    const driverId = created[1];
    await db.session.create({
      data: { userId: driverId, sessionToken: `s2-${tag}`, expiresAt: later },
    });
    await db.user.update({ where: { id: driverId }, data: { failedLoginAttempts: 2 } });

    await repo.resetPassword(driverId, "hash-nueva");
    const driver = await db.user.findUniqueOrThrow({ where: { id: driverId } });
    expect(driver).toMatchObject({
      passwordHash: "hash-nueva",
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(await db.session.count({ where: { userId: driverId } })).toBe(0);
    expect(await db.authToken.count({ where: { userId: driverId, usedAt: null } })).toBe(0);
  });
});
