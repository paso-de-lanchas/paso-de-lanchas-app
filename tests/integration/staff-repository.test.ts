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
  // Actor nulo: la bitácora es de solo inserción y borrar a un usuario con eventos fallaría.
  const audit = (action: string) => ({ userId: null, action });
  const auditCount = (entityId: string, action: string) =>
    db.auditLog.count({ where: { entity: "user", entityId, action } });

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
    const result = await repo.create(data, audit("STAFF_ACCOUNT_CREATED"));
    expect(result).not.toBeNull();
    created.push(result!.id);
    expect(await auditCount(result!.id, "STAFF_ACCOUNT_CREATED")).toBe(1);

    const account = await repo.findStaff(result!.id);
    expect(account).toMatchObject({
      role: "ADMIN",
      status: "ACTIVE",
      dockId,
      dockName: `Muelle ${tag}`,
      mustChangePassword: true,
    });
    expect(
      await repo.create({ ...data, fullName: "Otro" }, audit("STAFF_ACCOUNT_CREATED")),
    ).toBeNull();
    expect(await repo.dockExists(dockId)).toBe(true);
  });

  it("nunca devuelve ni modifica a un superadministrador", async () => {
    expect(await repo.findStaff(superadminId)).toBeNull();
    expect((await repo.list({})).some((a) => a.id === superadminId)).toBe(false);
    expect(await repo.setStatus(superadminId, ["ACTIVE"], "INACTIVE", audit("X"))).toBe(false);
    expect(await repo.resetPassword(superadminId, "otro", audit("X"))).toBe(false);
    expect(await repo.unlock(superadminId, audit("X"))).toBe(false);
    const superadmin = await db.user.findUniqueOrThrow({ where: { id: superadminId } });
    expect(superadmin).toMatchObject({ status: "ACTIVE", passwordHash: "x" });
    // Si no cambió nada, tampoco queda nada en la bitácora.
    expect(await db.auditLog.count({ where: { entity: "user", entityId: superadminId } })).toBe(0);
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

    expect(await repo.setStatus(driver.id, ["INACTIVE"], "ACTIVE", audit("REACTIVATED"))).toBe(
      false,
    );
    expect(
      await repo.setStatus(driver.id, ["ACTIVE", "BLOCKED"], "INACTIVE", audit("DEACTIVATED")),
    ).toBe(true);
    expect(await auditCount(driver.id, "REACTIVATED")).toBe(0);
    expect(await auditCount(driver.id, "DEACTIVATED")).toBe(1);
    expect(await db.session.count({ where: { userId: driver.id } })).toBe(0);
    expect((await repo.list({ role: "DRIVER", status: "INACTIVE" })).map((a) => a.id)).toContain(
      driver.id,
    );

    expect(await repo.unlock(driver.id, audit("UNLOCKED"))).toBe(true);
    expect(await repo.findStaff(driver.id)).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(await auditCount(driver.id, "UNLOCKED")).toBe(1);
  });

  it("restablecer guarda la temporal, obliga a cambiarla y cierra sesiones y enlaces", async () => {
    const driverId = created[1];
    await db.session.create({
      data: { userId: driverId, sessionToken: `s2-${tag}`, expiresAt: later },
    });
    await db.user.update({ where: { id: driverId }, data: { failedLoginAttempts: 2 } });

    expect(await repo.resetPassword(driverId, "hash-nueva", audit("RESET"))).toBe(true);
    expect(await auditCount(driverId, "RESET")).toBe(1);
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

  it("si la bitácora falla, el cambio tampoco se aplica (misma transacción)", async () => {
    const driverId = created[1];
    // Un actor que no existe hace fallar el INSERT en audit_logs (llave foránea).
    const broken = { userId: "00000000-0000-4000-8000-00000000dead", action: "BROKEN" };
    await expect(repo.resetPassword(driverId, "hash-sin-bitacora", broken)).rejects.toThrow();
    await expect(repo.setStatus(driverId, ["INACTIVE"], "ACTIVE", broken)).rejects.toThrow();
    const driver = await db.user.findUniqueOrThrow({ where: { id: driverId } });
    expect(driver).toMatchObject({ passwordHash: "hash-nueva", status: "INACTIVE" });
    await expect(
      repo.create(
        {
          email: "sin-bitacora-" + tag + "@pasolanchas.test",
          fullName: "Sin bitácora",
          phone: "9211234567",
          role: "DRIVER",
          dockId: null,
          passwordHash: "x",
          createdAt: new Date(),
        },
        broken,
      ),
    ).rejects.toThrow();
    expect(
      await db.user.count({ where: { email: "sin-bitacora-" + tag + "@pasolanchas.test" } }),
    ).toBe(0);
  });
});
