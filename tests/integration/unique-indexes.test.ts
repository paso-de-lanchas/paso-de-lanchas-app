/**
 * Índices únicos parciales de las migraciones "indices_unicos_asignaciones_descuentos" (issue #27)
 * y "placas_unicas_solo_activas" (issue #40).
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
  let vehicleTypeId: number;

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
    const vehicleType = await db.vehicleType.upsert({
      where: { name: `Auto-${suffix}` },
      update: {},
      create: { name: `Auto-${suffix}` },
    });
    driverId = driver.id;
    passengerId = passenger.id;
    vesselId = vessel.id;
    vehicleTypeId = vehicleType.id;
  });

  afterAll(async () => {
    await db.vehicle.deleteMany({ where: { ownerId: passengerId } });
    await db.vehicleType.delete({ where: { id: vehicleTypeId } });
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

  it("permite volver a registrar placas de un vehículo borrado pero rechaza duplicados activos", async () => {
    const vehicleData = {
      ownerId: passengerId,
      vehicleTypeId,
      brand: "Nissan",
      model: "Versa",
      color: "Blanco",
      plate: `PL${suffix}`.slice(0, 10).toUpperCase(),
    };

    const first = await db.vehicle.create({ data: vehicleData });
    await expect(db.vehicle.create({ data: vehicleData })).rejects.toThrow();

    // Al borrar lógicamente el vehículo, sí se pueden volver a registrar las mismas placas.
    await db.vehicle.update({
      where: { id: first.id },
      data: { deletedAt: new Date() },
    });
    const second = await db.vehicle.create({ data: vehicleData });
    expect(second.id).not.toBe(first.id);

    // Con el nuevo vehículo activo, vuelve a rechazar un duplicado activo.
    await expect(db.vehicle.create({ data: vehicleData })).rejects.toThrow();
  });
});
