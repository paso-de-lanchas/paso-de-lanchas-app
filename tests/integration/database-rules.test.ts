/**
 * Pruebas de integración contra la base de pruebas de Docker (puerto 5435).
 * Comprueban que las reglas de la migración (CHECK e índices) protegen los datos aunque
 * el código tenga un error. Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("reglas de integridad en PostgreSQL", () => {
  const db = prisma!;
  let userId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `prueba-${Date.now()}@pasolanchas.test`,
        fullName: "Prueba de integración",
        passwordHash: "x",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.wallet.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("no permite saldo negativo", async () => {
    await expect(db.wallet.create({ data: { userId, balance: "-1.00" } })).rejects.toThrow();
  });

  it("no permite modificar la bitácora de auditoría", async () => {
    const log = await db.auditLog.create({ data: { action: "TEST", entity: "test" } });
    await expect(
      db.auditLog.update({ where: { id: log.id }, data: { action: "CAMBIO" } }),
    ).rejects.toThrow();
  });
});
