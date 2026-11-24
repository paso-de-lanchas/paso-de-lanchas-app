/**
 * Datos de ejemplo para desarrollo local: `npm run db:seed`.
 * Se puede ejecutar varias veces (usa upsert). NUNCA pongas aquÃ­ datos reales.
 *
 * Cuentas de prueba (todas con la contraseÃ±a de SEED_PASSWORD):
 *   superadmin@pasolanchas.test   Superadministrador
 *   admin.coa@pasolanchas.test    Administrador del muelle Coatzacoalcos
 *   admin.val@pasolanchas.test    Administrador del muelle Villa Allende
 *   chofer1@pasolanchas.test      Chofer
 *   pasajero@pasolanchas.test     Pasajero con $100 de saldo
 *
 * Las tarifas, capacidades y coordenadas son APROXIMADAS hasta la visita de campo.
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const SEED_PASSWORD = "PasoLanchas-dev-2026";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await hash(SEED_PASSWORD);
  const now = new Date();

  // --- Muelles
  const coa = await prisma.dock.upsert({
    where: { code: "COA" },
    update: {},
    create: { code: "COA", name: "Coatzacoalcos", latitude: "18.149700", longitude: "-94.434900" },
  });
  const val = await prisma.dock.upsert({
    where: { code: "VAL" },
    update: {},
    create: { code: "VAL", name: "Villa Allende", latitude: "18.143500", longitude: "-94.444300" },
  });

  // --- Horario de servicio (06:00 a 22:00 todos los dÃ­as, a confirmar)
  for (const dock of [coa, val]) {
    for (let weekday = 0; weekday <= 6; weekday++) {
      await prisma.serviceHour.upsert({
        where: { dockId_weekday: { dockId: dock.id, weekday } },
        update: {},
        create: {
          dockId: dock.id,
          weekday,
          opensAt: new Date("1970-01-01T06:00:00Z"),
          closesAt: new Date("1970-01-01T22:00:00Z"),
        },
      });
    }
  }

  // --- Tipos de vehÃ­culo (transbordador)
  const vehicleTypeNames = ["AutomÃ³vil", "Motocicleta", "Camioneta", "Bicicleta"];
  const vehicleTypes = new Map<string, number>();
  for (const name of vehicleTypeNames) {
    const vt = await prisma.vehicleType.upsert({ where: { name }, update: {}, create: { name } });
    vehicleTypes.set(name, vt.id);
  }

  // --- Usuarios de prueba
  const user = (
    email: string,
    fullName: string,
    role: "PASSENGER" | "DRIVER" | "ADMIN" | "SUPERADMIN",
    dockId?: string,
  ) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        fullName,
        role,
        dockId,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: now,
        privacyAcceptedAt: now,
      },
    });

  const superadmin = await user(
    "superadmin@pasolanchas.test",
    "Superadministrador de prueba",
    "SUPERADMIN",
  );
  const adminCoa = await user("admin.coa@pasolanchas.test", "Admin Coatzacoalcos", "ADMIN", coa.id);
  await user("admin.val@pasolanchas.test", "Admin Villa Allende", "ADMIN", val.id);
  const driver = await user("chofer1@pasolanchas.test", "Chofer de prueba", "DRIVER");
  const passenger = await user("pasajero@pasolanchas.test", "Pasajera de prueba", "PASSENGER");

  await prisma.wallet.upsert({
    where: { userId: passenger.id },
    update: {},
    create: { userId: passenger.id, balance: "100.00" },
  });

  // --- Computadora autorizada de la taquilla de Coatzacoalcos
  await prisma.authorizedDevice.upsert({
    where: { deviceTokenHash: "seed-device-coa-1" },
    update: {},
    create: {
      dockId: coa.id,
      name: "Taquilla COA 1",
      deviceTokenHash: "seed-device-coa-1",
      status: "APPROVED",
      requestedById: adminCoa.id,
      approvedById: superadmin.id,
      approvedAt: now,
    },
  });

  // --- Flota: 2 lanchas activas, 1 embargada y 2 transbordadores (uno descompuesto)
  const vessels = [
    {
      code: "L-01",
      name: "Lancha 1",
      kind: "BOAT",
      registration: "SEED-L01",
      passengerCapacity: 20,
      status: "ACTIVE",
    },
    {
      code: "L-02",
      name: "Lancha 2",
      kind: "BOAT",
      registration: "SEED-L02",
      passengerCapacity: 20,
      status: "ACTIVE",
    },
    {
      code: "L-03",
      name: "Lancha 3",
      kind: "BOAT",
      registration: "SEED-L03",
      passengerCapacity: 20,
      status: "SEIZED",
    },
    {
      code: "T-01",
      name: "Transbordador 1",
      kind: "FERRY",
      registration: "SEED-T01",
      passengerCapacity: 60,
      status: "ACTIVE",
    },
    {
      code: "T-02",
      name: "Transbordador 2",
      kind: "FERRY",
      registration: "SEED-T02",
      passengerCapacity: 60,
      status: "OUT_OF_SERVICE",
    },
  ] as const;

  for (const v of vessels) {
    const vessel = await prisma.vessel.upsert({ where: { code: v.code }, update: {}, create: v });
    if (v.kind === "FERRY") {
      for (const [name, capacity] of [
        ["AutomÃ³vil", 12],
        ["Motocicleta", 10],
        ["Camioneta", 6],
      ] as const) {
        await prisma.vesselVehicleCapacity.upsert({
          where: {
            vesselId_vehicleTypeId: { vesselId: vessel.id, vehicleTypeId: vehicleTypes.get(name)! },
          },
          update: {},
          create: { vesselId: vessel.id, vehicleTypeId: vehicleTypes.get(name)!, capacity },
        });
      }
    }
    if (v.code === "L-01") {
      const assigned = await prisma.vesselDriver.findFirst({
        where: { vesselId: vessel.id, driverId: driver.id },
      });
      if (!assigned)
        await prisma.vesselDriver.create({ data: { vesselId: vessel.id, driverId: driver.id } });
    }
  }

  // --- Tarifas vigentes (de ejemplo; transbordador segÃºn prensa: $15 auto, $5 moto, $1 peatÃ³n)
  if ((await prisma.fare.count()) === 0) {
    await prisma.fare.createMany({
      data: [
        { vesselKind: "BOAT", category: "GENERAL", amount: "10.00", createdById: superadmin.id },
        { vesselKind: "BOAT", category: "STUDENT", amount: "5.00", createdById: superadmin.id },
        { vesselKind: "BOAT", category: "INAPAM", amount: "5.00", createdById: superadmin.id },
        { vesselKind: "FERRY", category: "PEDESTRIAN", amount: "1.00", createdById: superadmin.id },
        {
          vesselKind: "FERRY",
          category: "VEHICLE",
          vehicleTypeId: vehicleTypes.get("AutomÃ³vil"),
          amount: "15.00",
          createdById: superadmin.id,
        },
        {
          vesselKind: "FERRY",
          category: "VEHICLE",
          vehicleTypeId: vehicleTypes.get("Motocicleta"),
          amount: "5.00",
          createdById: superadmin.id,
        },
        {
          vesselKind: "FERRY",
          category: "VEHICLE",
          vehicleTypeId: vehicleTypes.get("Camioneta"),
          amount: "20.00",
          createdById: superadmin.id,
        },
      ],
    });
  }

  // --- Reglas configurables
  const settings: Record<string, unknown> = {
    max_tickets_per_sale: 5, // PENDIENTE: definir con el equipo
    qr_step_seconds: 30,
    session_timeout_minutes_staff: 30,
    max_failed_logins: 5,
    lockout_minutes: 15, // bloqueo temporal del personal tras los intentos fallidos
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never, updatedById: superadmin.id },
    });
  }

  if ((await prisma.announcement.count()) === 0)
    await prisma.announcement.create({
      data: {
        title: "Bienvenido a Paso de Lanchas",
        message: "Aviso de ejemplo para ambos muelles.",
        createdById: adminCoa.id,
      },
    });

  console.log("Datos de ejemplo cargados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// PENDIENTE: confirmar en campo con operación de muelles
await prisma.systemSetting.upsert({
  where: { key: "max_boarding_minutes" },
  update: {},
  create: {
    key: "max_boarding_minutes",
    value: { minutes: 20 },
  },
});