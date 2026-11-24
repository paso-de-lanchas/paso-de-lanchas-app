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
  let departureId = "";

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

    const departure = await db.departure.create({
      data: {
        vesselId,
        originDockId,
        destinationDockId,
        status: "BOARDING",
        queuePosition: null,
        passengerCapacity: 20,
        occupiedSeats: 0,
        boardingStartedAt: new Date(),
      },
    });
    departureId = departure.id;
  });

  afterAll(async () => {
    if (departureId) {
      await db.departure.deleteMany({ where: { id: departureId } });
    }
    if (vesselId) {
      await db.vessel.deleteMany({ where: { id: vesselId } });
    }
    await db.$disconnect();
  });

  it("dos occupySeat al mismo tiempo devuelven números de lugar distintos", async () => {
    const [seatA, seatB] = await Promise.all([
      db.$transaction((tx) => repo.occupySeat(tx, departureId)),
      db.$transaction((tx) => repo.occupySeat(tx, departureId)),
    ]);

    expect([seatA, seatB].sort((a, b) => a - b)).toEqual([1, 2]);

    const updated = await db.departure.findUnique({
      where: { id: departureId },
      select: { occupiedSeats: true },
    });
    expect(updated?.occupiedSeats).toBe(2);
  });
});
