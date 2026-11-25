/**
 * Pruebas de integración para PrismaDepartureRepository contra la BD de pruebas.
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio de salidas y concurrencia", () => {
  const db = prisma!;
  const repo = new PrismaDepartureRepository(db);
  let originDockId = "";
  let destinationDockId = "";
  let vesselId = "";

  beforeAll(async () => {
    const coa = await db.dock.upsert({
      where: { code: "COA" },
      update: {},
      create: {
        code: "COA",
        name: "Coatzacoalcos",
        latitude: 18.1506,
        longitude: -94.4342,
      },
    });
    const val = await db.dock.upsert({
      where: { code: "VAL" },
      update: {},
      create: {
        code: "VAL",
        name: "Villa Allende",
        latitude: 18.1592,
        longitude: -94.4054,
      },
    });
    originDockId = coa.id;
    destinationDockId = val.id;

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const vessel = await db.vessel.create({
      data: {
        code: `T-${suffix.slice(-6)}`,
        registration: `MAT-${suffix.slice(-6)}`,
        name: `Embarcación Prueba ${suffix}`,
        kind: "BOAT",
        status: "ACTIVE",
        passengerCapacity: 20,
      },
    });
    vesselId = vessel.id;
  });

  afterAll(async () => {
    if (vesselId) {
      await db.departure.deleteMany({ where: { vesselId } });
      await db.vessel.deleteMany({ where: { id: vesselId } });
    }
    await db.$disconnect();
  });

  it("encola una salida en transacción y detecta embarcación activa", async () => {
    const created = await repo.enqueueDepartureInTx({
      vesselId,
      driverId: "00000000-0000-0000-0000-000000000001",
      originDockId,
      destinationDockId,
      passengerCapacity: 20,
      vehicleCapacities: [],
      startedAt: new Date("2026-11-24T18:00:00.000Z"),
    });

    expect(created.vesselId).toBe(vesselId);
    const active = await repo.findActiveDepartureByVessel(vesselId);
    expect(active?.id).toBe(created.id);
  });
});
