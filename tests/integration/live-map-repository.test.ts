/**
 * Mapa en vivo contra PostgreSQL (#72): toma la ÚLTIMA ubicación de cada salida en tránsito
 * y nada de las demás. Requiere `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaLiveMapRepository } from "@/infrastructure/map/prisma-live-map-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

const run = `${Math.random().toString(36).slice(2, 6)}${Date.now().toString(36).slice(-5)}`;
let seq = 0;
const uniq = (prefix: string) => `${prefix}${++seq}${run}`.slice(0, 10);

describe.skipIf(!prisma)("repositorio del mapa en vivo", () => {
  const db = prisma!;
  let withPoints = "";
  let withoutPoints = "";
  let boarding = "";

  beforeAll(async () => {
    const [origin, destination] = await Promise.all(
      ["A", "B"].map((name) =>
        db.dock.create({
          data: { code: uniq("M"), name: `Muelle ${name}`, latitude: "18.1", longitude: "-94.4" },
        }),
      ),
    );
    const vessel = (name: string) =>
      db.vessel.create({
        data: {
          code: uniq("V"),
          name,
          kind: "BOAT",
          registration: `MAT-${uniq("R")}`,
          passengerCapacity: 20,
        },
      });
    const departure = async (name: string, status: "IN_TRANSIT" | "BOARDING") =>
      db.departure.create({
        data: {
          vesselId: (await vessel(name)).id,
          originDockId: origin!.id,
          destinationDockId: destination!.id,
          status,
          passengerCapacity: 20,
          occupiedSeats: 7,
          departedAt: status === "IN_TRANSIT" ? new Date() : null,
        },
      });

    withPoints = (await departure(`Con puntos ${run}`, "IN_TRANSIT")).id;
    withoutPoints = (await departure(`Sin puntos ${run}`, "IN_TRANSIT")).id;
    boarding = (await departure(`Abordando ${run}`, "BOARDING")).id;

    const now = Date.now();
    await db.tripLocation.createMany({
      data: [
        {
          departureId: withPoints,
          latitude: "18.140000",
          longitude: "-94.430000",
          recordedAt: new Date(now - 30_000),
        },
        {
          departureId: withPoints,
          latitude: "18.145000",
          longitude: "-94.440000",
          speedKmh: "12.5",
          heading: "230.0",
          recordedAt: new Date(now - 5_000),
        },
        {
          departureId: withPoints,
          latitude: "18.142000",
          longitude: "-94.435000",
          recordedAt: new Date(now - 15_000),
        },
        {
          departureId: boarding,
          latitude: "18.100000",
          longitude: "-94.400000",
          recordedAt: new Date(now),
        },
      ],
    });
  });

  afterAll(async () => {
    await db.departure.updateMany({
      where: { id: { in: [withPoints, withoutPoints, boarding] } },
      data: { status: "FINISHED" },
    });
    await db.$disconnect();
  });

  it("solo trae salidas en tránsito, con su última ubicación", async () => {
    const departures = await createPrismaLiveMapRepository(db).listInTransit();
    const mine = departures.filter((d) =>
      [withPoints, withoutPoints, boarding].includes(d.departureId),
    );

    expect(mine.map((d) => d.departureId).sort()).toEqual([withPoints, withoutPoints].sort());

    const tracked = mine.find((d) => d.departureId === withPoints)!;
    expect(tracked).toMatchObject({
      vesselKind: "BOAT",
      occupiedSeats: 7,
      passengerCapacity: 20,
      lastLocation: { latitude: 18.145, longitude: -94.44, speedKmh: 12.5, heading: 230 },
    });

    expect(mine.find((d) => d.departureId === withoutPoints)?.lastLocation).toBeNull();
  });

  it("los muelles traen coordenadas numéricas y la duración del cruce tiene un valor", async () => {
    const repo = createPrismaLiveMapRepository(db);
    const docks = await repo.listDocks();
    expect(docks.length).toBeGreaterThanOrEqual(2);
    expect(typeof docks[0]?.latitude).toBe("number");
    expect(await repo.getCrossingMinutes()).toBeGreaterThan(0);
  });
});
