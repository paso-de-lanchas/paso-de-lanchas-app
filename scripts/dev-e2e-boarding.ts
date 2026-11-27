/**
 * SOLO PARA PRUEBAS DE NAVEGADOR (tests/e2e/taquilla.spec.ts): deja en la base local una
 * lancha abordando en Villa Allende y un pasajero con $100 y una credencial QR, y escribe en
 * la salida el texto del QR vigente (lo que el lector USB "teclearía").
 *
 *   npx tsx scripts/dev-e2e-boarding.ts            → prepara todo y escribe {"qr": "PL1…"}
 *   npx tsx scripts/dev-e2e-boarding.ts --qr-only  → solo el QR de la credencial ya creada
 *
 * Usa el muelle de Villa Allende para no chocar con la prueba de la fila (Coatzacoalcos).
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { buildQrPayload, timeStepAt } from "../src/domain/qr/qr-payload";
import { PrismaClient } from "../src/generated/prisma/client";
import { decryptSecret, encryptSecret } from "../src/infrastructure/qr/secret-cipher";
import { codeForTimeStep, newSecret } from "../src/infrastructure/qr/totp";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL ?? "";
const signingSecret = process.env.QR_SIGNING_SECRET ?? "";
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
if (signingSecret.length < 32) {
  console.error("Falta QR_SIGNING_SECRET (mínimo 32 caracteres) en .env.local.");
  process.exit(1);
}

export const E2E_BOARDING_PASSENGER = "pasajero.abordaje@pasolanchas.test";
const VESSEL_CODE = "E2E-L1";
const STEP_SECONDS = 30;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function currentQr(userId: string): Promise<string> {
  const credential = await prisma.qrCredential.findFirstOrThrow({
    where: { userId, revokedAt: null },
  });
  const secret = decryptSecret(
    Buffer.from(credential.totpSecretEnc).toString("utf8"),
    signingSecret,
  );
  const code = await codeForTimeStep(secret, timeStepAt(Date.now(), STEP_SECONDS), STEP_SECONDS);
  return buildQrPayload({ credentialId: credential.id, code });
}

async function prepare(): Promise<string> {
  const [val, coa] = await Promise.all([
    prisma.dock.findUniqueOrThrow({ where: { code: "VAL" } }),
    prisma.dock.findUniqueOrThrow({ where: { code: "COA" } }),
  ]);

  const passenger = await prisma.user.upsert({
    where: { email: E2E_BOARDING_PASSENGER },
    update: { status: "ACTIVE", deletedAt: null },
    create: {
      email: E2E_BOARDING_PASSENGER,
      fullName: "Pasajera de abordaje",
      passwordHash: await hash("PasoLanchas-dev-2026"),
      role: "PASSENGER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });
  await prisma.wallet.upsert({
    where: { userId: passenger.id },
    update: { balance: "100.00", version: { increment: 1 } },
    create: { userId: passenger.id, balance: "100.00" },
  });
  await prisma.qrCredential.updateMany({
    where: { userId: passenger.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.qrCredential.create({
    data: {
      userId: passenger.id,
      totpSecretEnc: Buffer.from(encryptSecret(newSecret(), signingSecret)),
    },
  });

  const vessel = await prisma.vessel.upsert({
    where: { code: VESSEL_CODE },
    update: { status: "ACTIVE", passengerCapacity: 5 },
    create: {
      code: VESSEL_CODE,
      name: "Lancha de pruebas",
      kind: "BOAT",
      registration: "E2E-MAT-L1",
      passengerCapacity: 5,
    },
  });

  // Una sola salida abordando por muelle: se cierran las que hayan quedado de otra corrida.
  await prisma.departure.updateMany({
    where: {
      OR: [
        { originDockId: val.id, status: "BOARDING" },
        { vesselId: vessel.id, status: { in: ["QUEUED", "BOARDING", "BOARDING_CLOSED"] } },
      ],
    },
    data: { status: "CANCELLED", cancelReason: "Limpieza de pruebas de navegador" },
  });
  await prisma.departure.create({
    data: {
      vesselId: vessel.id,
      originDockId: val.id,
      destinationDockId: coa.id,
      status: "BOARDING",
      passengerCapacity: 5,
      boardingStartedAt: new Date(),
    },
  });

  return currentQr(passenger.id);
}

async function main() {
  const qrOnly = process.argv.includes("--qr-only");
  const qr = qrOnly
    ? await currentQr(
        (await prisma.user.findUniqueOrThrow({ where: { email: E2E_BOARDING_PASSENGER } })).id,
      )
    : await prepare();
  console.log(JSON.stringify({ qr }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
