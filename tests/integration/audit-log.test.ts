/**
 * Bitácora contra PostgreSQL (#69): es inmutable (RF-123) y se filtra por usuario, acción y
 * fecha (RF-124). Requiere `docker compose up -d` y `npm run db:test:prepare`.
 * Los registros no se borran al final: la base no lo permite (eso mismo se prueba aquí).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createListAuditLogs } from "@/application/audit/list-audit-logs";
import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogReader } from "@/infrastructure/audit/prisma-audit-log-reader";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("bitácora en PostgreSQL", () => {
  const db = prisma!;
  const tag = `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-5)}`;
  const action = `TEST_${tag.toUpperCase()}`.slice(0, 60);
  let entryId: bigint;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `auditor-${tag}@pasolanchas.test`,
        fullName: "Auditor de prueba",
        passwordHash: "test-hash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    const entry = await db.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: "pruebas",
        entityId: tag,
        details: { amountCents: 100, password: "nunca-se-ve" },
        createdAt: new Date("2026-11-27T18:00:00.000Z"),
      },
    });
    entryId = entry.id;
    await db.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: "pruebas",
        entityId: `${tag}-viejo`,
        createdAt: new Date("2026-11-20T18:00:00.000Z"),
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("nadie puede modificar un registro (RF-123)", async () => {
    await expect(
      db.auditLog.update({ where: { id: entryId }, data: { action: "ALTERADO" } }),
    ).rejects.toThrow();
    const after = await db.auditLog.findUniqueOrThrow({ where: { id: entryId } });
    expect(after.action).toBe(action);
  });

  it("nadie puede borrar un registro (RF-123)", async () => {
    await expect(db.auditLog.delete({ where: { id: entryId } })).rejects.toThrow();
    await expect(db.auditLog.deleteMany({ where: { action } })).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action } })).toBe(2);
  });

  it("filtra por acción, usuario y día en hora de México, y oculta secretos", async () => {
    const list = createListAuditLogs(createPrismaAuditLogReader(db));

    const all = await list({ accion: action });
    expect(all.total).toBe(2);
    // La más reciente primero.
    expect(all.rows[0]?.entityId).toBe(tag);
    expect(all.rows[0]?.details).toEqual({ amountCents: 100, password: "[oculto]" });

    const byDay = await list({ accion: action, desde: "2026-11-27", hasta: "2026-11-27" });
    expect(byDay.rows.map((r) => r.entityId)).toEqual([tag]);

    const byUser = await list({ usuario: `AUDITOR-${tag}`, accion: action });
    expect(byUser.total).toBe(2);
    const otherUser = await list({ usuario: "nadie-con-este-correo", accion: action });
    expect(otherUser.total).toBe(0);

    expect(all.actions).toContain(action);
  });
});
