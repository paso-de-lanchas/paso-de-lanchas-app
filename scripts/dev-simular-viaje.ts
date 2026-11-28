/**
 * SOLO PARA DESARROLLO Y DEMOS: simula una lancha cruzando de Coatzacoalcos a Villa Allende y
 * guarda su ubicación en `trip_locations`, como lo hará el celular del chofer (#49).
 *
 *   npm run dev:simular-viaje                      → cruza en 2 min, un punto cada 4 s
 *   npm run dev:simular-viaje -- --once 0.5        → un solo punto a la mitad del cruce (pruebas)
 *   npm run dev:simular-viaje -- --terminar        → termina el viaje simulado
 *
 * Usa una embarcación propia ("Lancha simulada", SIM-L1) y nunca toca las del seed.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "db"].includes(host)) {
  console.error("Este script solo corre contra la base local de Docker. No se cambió nada.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const VESSEL_CODE = "SIM-L1";
const STEP_MS = 4_000;
const CROSSING_MS = 120_000;
const SPEED_KMH = 14;

async function prepareDeparture() {
  const [coa, val] = await Promise.all([
    prisma.dock.findUniqueOrThrow({ where: { code: "COA" } }),
    prisma.dock.findUniqueOrThrow({ where: { code: "VAL" } }),
  ]);
  const vessel = await prisma.vessel.upsert({
    where: { code: VESSEL_CODE },
    update: { status: "ACTIVE" },
    create: {
      code: VESSEL_CODE,
      name: "Lancha simulada",
      kind: "BOAT",
      registration: "SIM-MAT-L1",
      passengerCapacity: 20,
    },
  });
  // Termina cualquier viaje simulado anterior y empieza uno nuevo.
  await prisma.departure.updateMany({
    where: {
      vesselId: vessel.id,
      status: { in: ["QUEUED", "BOARDING", "BOARDING_CLOSED", "IN_TRANSIT"] },
    },
    data: { status: "FINISHED", arrivedAt: new Date() },
  });
  const departure = await prisma.departure.create({
    data: {
      vesselId: vessel.id,
      originDockId: coa.id,
      destinationDockId: val.id,
      status: "IN_TRANSIT",
      passengerCapacity: 20,
      occupiedSeats: 8,
      departedAt: new Date(),
    },
  });
  return { departure, coa, val };
}

function pointAt(
  progress: number,
  from: { latitude: unknown; longitude: unknown },
  to: { latitude: unknown; longitude: unknown },
) {
  const lerp = (a: unknown, b: unknown) => Number(a) + (Number(b) - Number(a)) * progress;
  return {
    latitude: lerp(from.latitude, to.latitude).toFixed(6),
    longitude: lerp(from.longitude, to.longitude).toFixed(6),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--terminar")) {
    const result = await prisma.departure.updateMany({
      where: { vessel: { code: VESSEL_CODE }, status: "IN_TRANSIT" },
      data: { status: "FINISHED", arrivedAt: new Date() },
    });
    console.log(`Viajes simulados terminados: ${result.count}`);
    return;
  }

  const { departure, coa, val } = await prepareDeparture();
  const onceIndex = args.indexOf("--once");

  if (onceIndex >= 0) {
    const progress = Math.min(1, Math.max(0, Number(args[onceIndex + 1] ?? 0.5)));
    await prisma.tripLocation.create({
      data: {
        departureId: departure.id,
        ...pointAt(progress, coa, val),
        speedKmh: SPEED_KMH.toFixed(1),
      },
    });
    console.log(JSON.stringify({ departureId: departure.id, progress }));
    return;
  }

  console.log("Lancha simulada cruzando de Coatzacoalcos a Villa Allende… (Ctrl+C para parar)");
  const start = Date.now();
  for (;;) {
    const progress = Math.min(1, (Date.now() - start) / CROSSING_MS);
    await prisma.tripLocation.create({
      data: {
        departureId: departure.id,
        ...pointAt(progress, coa, val),
        speedKmh: SPEED_KMH.toFixed(1),
      },
    });
    if (progress >= 1) break;
    await new Promise((resolve) => setTimeout(resolve, STEP_MS));
  }
  await prisma.departure.update({
    where: { id: departure.id },
    data: { status: "FINISHED", arrivedAt: new Date() },
  });
  console.log("Llegó a Villa Allende.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
