/**
 * Persistencia y bitácora de avisos a pasajeros (`announcements` y `audit_logs`, issue #73).
 * Requiere `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio y bitácora de avisos", () => {
  const db = prisma!;
  const suffix = Date.now().toString(36);
  let adminId: string;
  let dockId: string;

  beforeAll(async () => {
    const admin = await db.user.create({
      data: {
        email: `admin-avisos-${suffix}@pasolanchas.test`,
        fullName: "Admin Avisos",
        passwordHash: "x",
        role: "ADMIN",
      },
    });
    const dock = await db.dock.create({
      data: {
        code: `A${suffix}`.slice(0, 10),
        name: `Muelle Prueba ${suffix}`,
        latitude: 18.1489,
        longitude: -94.4144,
      },
    });
    adminId = admin.id;
    dockId = dock.id;
  });

  afterAll(async () => {
    await db.dockServiceOverride.deleteMany({ where: { dockId } });
    await db.announcement.deleteMany({ where: { createdById: adminId } });
    await db.dock.delete({ where: { id: dockId } });
    await db.$disconnect();
  });

  it("publica un aviso en announcements, registra ANNOUNCEMENT_PUBLISHED en audit_logs y filtra por vigencia", async () => {
    const now = new Date("2026-11-28T16:00:00.000Z");

    const created = await db.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          dockId,
          title: "Aviso meteorológico",
          message: "Viento del norte moderado.",
          startsAt: new Date("2026-11-28T15:00:00.000Z"),
          endsAt: new Date("2026-11-28T19:00:00.000Z"),
          createdById: adminId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "ANNOUNCEMENT_PUBLISHED",
          entity: "announcement",
          entityId: announcement.id,
          details: { title: announcement.title },
        },
      });
      return announcement;
    });

    const active = await db.announcement.findMany({
      where: {
        id: created.id,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    });
    expect(active).toHaveLength(1);

    const log = await db.auditLog.findFirst({
      where: { entity: "announcement", entityId: created.id, action: "ANNOUNCEMENT_PUBLISHED" },
    });
    expect(log).not.toBeNull();
  });
});
