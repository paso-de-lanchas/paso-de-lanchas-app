/**
 * SOLO PARA PRUEBAS DE NAVEGADOR: deja listas en la base local de Docker las cuentas que usan
 * las pruebas de contraseña (tests/e2e/contrasena.spec.ts) y los datos de operación de fila.
 * Playwright lo corre una vez antes de empezar (tests/e2e/global-setup.ts). Cada vez restablece
 * sus datos y borra enlaces, sesiones y salidas previas de prueba para poder correrlas las veces que sea.
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { E2E_ACCOUNTS } from "../tests/e2e/accounts";

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

async function main() {
  for (const account of Object.values(E2E_ACCOUNTS)) {
    const data = {
      fullName: "Cuenta de prueba",
      passwordHash: await hash(account.password),
      role: account.role,
      status: "ACTIVE" as const,
      emailVerifiedAt: new Date(),
      mustChangePassword: account.mustChangePassword,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        ...data,
        ...(account.role === "PASSENGER" ? { wallet: { create: {} } } : {}),
      },
      update: data,
    });
    await prisma.authToken.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }

  const e2eDriver = await prisma.user.upsert({
    where: { email: "chofer.e2e@pasolanchas.test" },
    create: {
      email: "chofer.e2e@pasolanchas.test",
      fullName: "Chofer Prueba E2E",
      passwordHash: await hash("PasoLanchas2026!"),
      role: "DRIVER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
    update: {
      fullName: "Chofer Prueba E2E",
      role: "DRIVER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const e2eVessel = await prisma.vessel.upsert({
    where: { code: "E2E-01" },
    create: {
      code: "E2E-01",
      name: "Lancha E2E",
      kind: "BOAT",
      registration: "MAT-E2E-01",
      passengerCapacity: 25,
      status: "ACTIVE",
    },
    update: {
      name: "Lancha E2E",
      kind: "BOAT",
      passengerCapacity: 25,
      status: "ACTIVE",
    },
  });

  await prisma.departure.deleteMany({
    where: { vesselId: e2eVessel.id },
  });

  await prisma.vesselDriver.updateMany({
    where: {
      OR: [{ vesselId: e2eVessel.id }, { driverId: e2eDriver.id }],
      unassignedAt: null,
    },
    data: { unassignedAt: new Date() },
  });

  await prisma.vesselDriver.create({
    data: {
      vesselId: e2eVessel.id,
      driverId: e2eDriver.id,
    },
  });

  console.log(`Cuentas de prueba listas: ${Object.keys(E2E_ACCOUNTS).length}`);
}

main().finally(() => prisma.$disconnect());
