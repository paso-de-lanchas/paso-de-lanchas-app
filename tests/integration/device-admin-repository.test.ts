/**
 * Computadoras del muelle contra la base de pruebas (issue #42).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { prismaDeviceAdminRepository } from "@/infrastructure/devices/prisma-device-admin-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio de computadoras", () => {
  const db = prisma!;
  const repo = prismaDeviceAdminRepository(db);
  const tag = Date.now().toString(36);
  const later = new Date(Date.now() + 30 * 60 * 1000);
  let dockId = "";
  let adminId = "";
  let superadminId = "";
  let deviceId = "";

  beforeAll(async () => {
    const dock = await db.dock.create({
      data: {
        code: `D${tag}`.slice(0, 10),
        name: `Muelle ${tag}`,
        latitude: "18",
        longitude: "-94",
      },
    });
    dockId = dock.id;
    const admin = await db.user.create({
      data: {
        email: `admin-dev-${tag}@pasolanchas.test`,
        fullName: "Admin de prueba",
        passwordHash: "x",
        role: "ADMIN",
        status: "ACTIVE",
        dockId,
      },
    });
    adminId = admin.id;
    const superadmin = await db.user.create({
      data: {
        email: `super-dev-${tag}@pasolanchas.test`,
        fullName: "Super de prueba",
        passwordHash: "x",
        role: "SUPERADMIN",
        status: "ACTIVE",
      },
    });
    superadminId = superadmin.id;
    const device = await db.authorizedDevice.create({
      data: {
        name: "Computadora de Admin",
        deviceTokenHash: `dev-${tag}`,
        requestedById: adminId,
        dockId,
        sessions: {
          create: [{ userId: adminId, sessionToken: `sd-${tag}`, expiresAt: later }],
        },
      },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    await db.session.deleteMany({ where: { userId: adminId } });
    await db.authorizedDevice.deleteMany({ where: { requestedById: adminId } });
    await db.user.deleteMany({ where: { id: { in: [adminId, superadminId] } } });
    await db.dock.deleteMany({ where: { id: dockId } });
    await db.$disconnect();
  });

  it("muestra la solicitud pendiente con quién y cuándo la pidió", async () => {
    const pending = await repo.list("PENDING");
    const view = pending.find((d) => d.id === deviceId);
    expect(view).toMatchObject({
      status: "PENDING",
      dockName: `Muelle ${tag}`,
      requestedBy: { fullName: "Admin de prueba", role: "ADMIN", dockId },
      approvedByName: null,
    });
    expect(view!.requestedAt).toBeInstanceOf(Date);
  });

  // Actor nulo: la bitácora es de solo inserción y borrar a un usuario con eventos fallaría.
  const audit = (action: string) => ({ userId: null, action });
  const auditCount = (action: string) =>
    db.auditLog.count({ where: { entity: "authorized_device", entityId: deviceId, action } });

  it("si la bitácora falla, la aprobación tampoco se aplica (misma transacción)", async () => {
    const broken = { userId: "00000000-0000-4000-8000-00000000dead", action: "BROKEN" };
    const at = new Date();
    await expect(
      repo.approve(
        deviceId,
        { name: "Sin bitácora", dockId, approvedById: superadminId, at },
        broken,
      ),
    ).rejects.toThrow();
    expect((await repo.findById(deviceId))!.status).toBe("PENDING");
  });

  it("aprueba solo una vez y renombra", async () => {
    const at = new Date();
    expect(
      await repo.approve(
        deviceId,
        { name: "Taquilla 1", dockId, approvedById: superadminId, at },
        audit("APPROVED"),
      ),
    ).toBe(true);
    expect(
      await repo.approve(
        deviceId,
        { name: "Otra", dockId: null, approvedById: superadminId, at },
        audit("APPROVED"),
      ),
    ).toBe(false);
    expect(await auditCount("APPROVED")).toBe(1);
    expect(await repo.findById(deviceId)).toMatchObject({
      status: "APPROVED",
      name: "Taquilla 1",
      approvedByName: "Super de prueba",
    });
    expect(await repo.rename(deviceId, "Taquilla principal", audit("RENAMED"))).toBe(true);
    expect(await auditCount("RENAMED")).toBe(1);
    expect((await repo.findById(deviceId))!.name).toBe("Taquilla principal");
  });

  it("revocar borra las sesiones abiertas desde ella y no se repite", async () => {
    expect(await db.session.count({ where: { deviceId } })).toBe(1);
    expect(await repo.revoke(deviceId, audit("REVOKED"))).toBe(true);
    expect(await db.session.count({ where: { deviceId } })).toBe(0);
    expect(await repo.revoke(deviceId, audit("REVOKED"))).toBe(false);
    expect(await repo.rename(deviceId, "Ya no", audit("RENAMED"))).toBe(false);
    expect(await auditCount("REVOKED")).toBe(1);
    expect(await auditCount("RENAMED")).toBe(1);
    expect((await repo.list("REVOKED")).map((d) => d.id)).toContain(deviceId);
  });
});
