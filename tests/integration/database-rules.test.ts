/**
 * Pruebas de integración contra la base de pruebas de Docker (puerto 5435).
 * Comprueban que las reglas de la migración (CHECK e índices) protegen los datos aunque
 * el código tenga un error. Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { Money } from "@/domain/shared/money";
import { prismaFareRepository } from "@/infrastructure/fares/prisma-fare-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("reglas de integridad en PostgreSQL", () => {
  const db = prisma!;
  let userId: string;
  let vehicleTypeId: number;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `prueba-${Date.now()}@pasolanchas.test`,
        fullName: "Prueba de integración",
        passwordHash: "x",
      },
    });
    userId = user.id;
    const vehicleType = await db.vehicleType.create({
      data: { name: `test-${Date.now()}-${process.pid}` },
      select: { id: true },
    });
    vehicleTypeId = vehicleType.id;
  });

  afterAll(async () => {
    await db.fare.deleteMany({ where: { createdById: userId } });
    await db.vehicleType.delete({ where: { id: vehicleTypeId } });
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

  it("cierra la tarifa anterior en la misma transacción y conserva ambas vigencias", async () => {
    const repository = prismaFareRepository(db);
    const nextStart = new Date();
    const firstStart = new Date(nextStart.getTime() - 60_000);
    const fare = {
      vesselKind: "FERRY" as const,
      category: "VEHICLE" as const,
      vehicleTypeId,
      validTo: null,
      createdById: userId,
    };

    await repository.replaceCurrentFare({
      ...fare,
      amount: Money.fromPesos("7.00"),
      validFrom: firstStart,
    });
    await repository.replaceCurrentFare({
      ...fare,
      amount: Money.fromPesos("8.00"),
      validFrom: nextStart,
    });

    const history = await db.fare.findMany({
      where: { createdById: userId },
      orderBy: { validFrom: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history[0]?.validTo).toEqual(nextStart);
    expect(history[1]?.validFrom).toEqual(nextStart);
    expect(history[1]?.validTo).toBeNull();
    await expect(
      db.fare.create({
        data: {
          ...fare,
          amount: "9.00",
          validFrom: firstStart,
          validTo: new Date(nextStart.getTime() + 1),
        },
      }),
    ).rejects.toThrow();
  });
});
