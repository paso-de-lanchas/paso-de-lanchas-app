/**
 * Índices únicos parciales de la migración "indices_unicos_asignaciones_descuentos" (issue #27).
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("índices únicos parciales", () => {
  const db = prisma!;
  const suffix = Date.now().toString(36);
  let driverId: string;
  let passengerId: string;
  let vesselId: string;

  beforeAll(async () => {
    const driver = await db.user.create({
      data: {
        email: `chofer-${suffix}@pasolanchas.test`,
        fullName: "Chofer de prueba",
        passwordHash: "x",
        role: "DRIVER",
      },
    });
    const passenger = await db.user.create({
      data: {
        email: `pasajero-${suffix}@pasolanchas.test`,
        fullName: "Pasajero de prueba",
        passwordHash: "x",
      },
    });
    const vessel = await db.vessel.create({
      data: {
        code: `T${suffix}`.slice(0, 10),
        name: "Lancha de prueba",
        kind: "BOAT",
        registration: `REG-${suffix}`,
        passengerCapacity: 10,
      },
    });
    driverId = driver.id;
    passengerId = passenger.id;
    vesselId = vessel.id;
  });

  afterAll(async () => {
    await db.vesselDriver.deleteMany({ where: { vesselId } });
    await db.vessel.delete({ where: { id: vesselId } });
    await db.discountRequest.deleteMany({ where: { userId: passengerId } });
    await db.user.deleteMany({ where: { id: { in: [driverId, passengerId] } } });
    await db.$disconnect();
  });

  it("no permite dos asignaciones activas del mismo chofer a la misma embarcación", async () => {
    const first = await db.vesselDriver.create({ data: { driverId, vesselId } });
    await expect(db.vesselDriver.create({ data: { driverId, vesselId } })).rejects.toThrow();

    // Después de retirarlo, sí se puede volver a asignar.
    await db.vesselDriver.update({ where: { id: first.id }, data: { unassignedAt: new Date() } });
    await expect(db.vesselDriver.create({ data: { driverId, vesselId } })).resolves.toBeDefined();
  });

  it("no permite dos solicitudes de descuento pendientes del mismo pasajero", async () => {
    const pending = {
      userId: passengerId,
      discountType: "STUDENT" as const,
      credentialPhotoUrl: "credentials/prueba.jpg",
    };
    const first = await db.discountRequest.create({ data: pending });
    await expect(db.discountRequest.create({ data: pending })).rejects.toThrow();

    // Ya revisada, puede pedir otra.
    await db.discountRequest.update({
      where: { id: first.id },
      data: { status: "REJECTED", rejectionReason: "Prueba" },
    });
    await expect(db.discountRequest.create({ data: pending })).resolves.toBeDefined();
  });
});
