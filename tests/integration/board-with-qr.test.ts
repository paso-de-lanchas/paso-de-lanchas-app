/**
 * Escaneo del QR contra PostgreSQL de verdad (#44): bloqueo de la salida, cupo, cobro y
 * lugar en una sola transacción. Requiere `docker compose up -d` y `npm run db:test:prepare`.
 *
 * Los datos de prueba no se borran al final: la bitácora es inmutable y apunta a los
 * usuarios. Cada corrida usa nombres únicos, así que no chocan entre sí.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBoardWithQr, type BoardingActor } from "@/application/boarding/board-with-qr";
import type { QrScanVerifier, ScannedQr } from "@/application/boarding/ports";
import { BoardingError } from "@/domain/boarding/boarding";
import { Money } from "@/domain/shared/money";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBoardingStore } from "@/infrastructure/boarding/prisma-boarding-store";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

const run = `${Math.random().toString(36).slice(2, 6)}${Date.now().toString(36).slice(-6)}`;
let seq = 0;
/** Nombre único y corto: el número va primero para que sobreviva al recortarlo. */
const uniq = (prefix: string) => `${prefix}${++seq}${run}`.slice(0, 30);

/** El QR ya verificado: aquí se prueba la transacción, no la firma TOTP (#20 tiene sus pruebas). */
class MapVerifier implements QrScanVerifier {
  readonly codes = new Map<string, ScannedQr>();
  async verify(raw: string) {
    return this.codes.get(raw) ?? null;
  }
}

describe.skipIf(!prisma)("escaneo del QR en PostgreSQL", () => {
  const db = prisma!;
  const verifier = new MapVerifier();
  let fareCents = 0;
  let adminId = "";
  let destinationDockId = "";

  async function createDock() {
    const code = uniq("Q").slice(0, 10);
    return db.dock.create({
      data: { code, name: `Muelle ${code}`, latitude: "18.1", longitude: "-94.4" },
    });
  }

  /** Muelle con su admin, computadora autorizada y una salida abordando. */
  async function createBoardingDock(capacity: number) {
    const dock = await createDock();
    const admin = await db.user.create({
      data: {
        email: `${uniq("adm")}@pasolanchas.test`,
        fullName: "Admin de escaneo",
        passwordHash: "test-hash",
        role: "ADMIN",
        status: "ACTIVE",
        dockId: dock.id,
      },
    });
    adminId = admin.id;
    const device = await db.authorizedDevice.create({
      data: {
        dockId: dock.id,
        name: "Taquilla de prueba",
        deviceTokenHash: uniq("dev"),
        status: "APPROVED",
        requestedById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });
    const vessel = await db.vessel.create({
      data: {
        code: uniq("L").slice(0, 10),
        name: "Lancha de prueba",
        kind: "BOAT",
        registration: uniq("MAT"),
        passengerCapacity: capacity,
      },
    });
    const departure = await db.departure.create({
      data: {
        vesselId: vessel.id,
        originDockId: dock.id,
        destinationDockId,
        status: "BOARDING",
        passengerCapacity: capacity,
        boardingStartedAt: new Date(),
      },
    });
    const actor: BoardingActor = { adminId: admin.id, dockId: dock.id, deviceId: device.id };
    return { dock, vessel, departure, actor };
  }

  /** Pasajero activo con monedero, credencial QR y su código ya "escaneable". */
  async function createPassenger(balance: string) {
    const user = await db.user.create({
      data: {
        email: `${uniq("pas")}@pasolanchas.test`,
        fullName: `Pasajero ${seq}`,
        passwordHash: "test-hash",
        role: "PASSENGER",
        status: "ACTIVE",
      },
    });
    await db.wallet.create({ data: { userId: user.id, balance } });
    const credential = await db.qrCredential.create({
      data: { userId: user.id, totpSecretEnc: Buffer.from("no-se-usa") },
    });
    const qr = `QR-${user.id}`;
    verifier.codes.set(qr, { userId: user.id, credentialId: credential.id, timeStep: 1 });
    return { user, qr };
  }

  const balanceOf = async (userId: string) =>
    Money.fromPesos((await db.wallet.findUniqueOrThrow({ where: { userId } })).balance).cents;

  const board = (store = new PrismaBoardingStore(db)) =>
    createBoardWithQr({ verifier, store, auditLogger: { log: async () => {} } });

  beforeAll(async () => {
    destinationDockId = (await createDock()).id;
    const now = new Date();
    const current = await db.fare.findFirst({
      where: {
        vesselKind: "BOAT",
        category: "GENERAL",
        vehicleTypeId: null,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    });
    if (current) {
      fareCents = Money.fromPesos(current.amount).cents;
    } else {
      const creator = await db.user.create({
        data: {
          email: `${uniq("tar")}@pasolanchas.test`,
          fullName: "Tarifas de prueba",
          passwordHash: "test-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      await db.fare.create({
        data: {
          vesselKind: "BOAT",
          category: "GENERAL",
          amount: "10.00",
          validFrom: new Date(now.getTime() - 60_000),
          createdById: creator.id,
        },
      });
      fareCents = 1000;
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("20 escaneos simultáneos en una salida de 10 lugares: exactamente 10 abordajes y 10 cobros", async () => {
    const { departure, actor } = await createBoardingDock(10);
    const passengers = await Promise.all(
      Array.from({ length: 20 }, () => createPassenger("100.00")),
    );

    const results = await Promise.allSettled(passengers.map(({ qr }) => board()({ qr }, actor)));

    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(10);
    expect(rejected).toHaveLength(10);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(BoardingError);
      // Ya llena: la salida se cerró (no hay otra abordando) o se ve sin lugares.
      expect(["NO_DEPARTURE_BOARDING", "DEPARTURE_FULL"]).toContain(r.reason.code);
    }

    const boardings = await db.boarding.findMany({
      where: { departureId: departure.id },
      orderBy: { seatNumber: "asc" },
    });
    expect(boardings.map((b) => b.seatNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const after = await db.departure.findUniqueOrThrow({ where: { id: departure.id } });
    expect(after.occupiedSeats).toBe(10);
    expect(after.status).toBe("BOARDING_CLOSED");

    const charges = await db.walletTransaction.count({
      where: { type: "FARE_CHARGE", saleId: { in: boardings.map((b) => b.saleId) } },
    });
    expect(charges).toBe(10);
    const balances = await Promise.all(passengers.map(({ user }) => balanceOf(user.id)));
    const total = balances.reduce((sum, cents) => sum + cents, 0);
    expect(total).toBe(20 * 10_000 - 10 * fareCents);

    const sales = await db.sale.findMany({ where: { id: { in: boardings.map((b) => b.saleId) } } });
    expect(sales.every((s) => s.channel === "QR_BALANCE" && s.ticketCount === 1)).toBe(true);
    const audits = await db.auditLog.count({
      where: { entity: "boardings", entityId: { in: boardings.map((b) => b.id) } },
    });
    expect(audits).toBe(10);
  });

  it("el mismo QR dos veces al mismo tiempo se cobra una sola vez", async () => {
    const { departure, actor } = await createBoardingDock(10);
    const { user, qr } = await createPassenger("100.00");

    const results = await Promise.allSettled([board()({ qr }, actor), board()({ qr }, actor)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(failure?.reason.code).toBe("ALREADY_BOARDED");
    expect(await db.boarding.count({ where: { departureId: departure.id } })).toBe(1);
    expect(await balanceOf(user.id)).toBe(10_000 - fareCents);
  });

  it("el mismo QR en dos muelles a la vez solo se cobra en uno (QR de un solo uso)", async () => {
    const first = await createBoardingDock(10);
    const second = await createBoardingDock(10);
    const { user, qr } = await createPassenger("100.00");

    const results = await Promise.allSettled([
      board()({ qr }, first.actor),
      board()({ qr }, second.actor),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(failure?.reason).toBeInstanceOf(BoardingError);
    expect(failure?.reason.code).toBe("QR_ALREADY_USED");
    expect(await balanceOf(user.id)).toBe(10_000 - fareCents);
  });

  it("si falla un paso a la mitad, el saldo no cambia y no queda venta ni abordaje", async () => {
    const { departure, actor } = await createBoardingDock(10);
    const { user, qr } = await createPassenger("100.00");

    class FailingStore extends PrismaBoardingStore {
      override async occupySeat(): Promise<never> {
        throw new Error("falla simulada después de cobrar");
      }
    }

    await expect(board(new FailingStore(db))({ qr }, actor)).rejects.toThrow("falla simulada");
    expect(await balanceOf(user.id)).toBe(10_000);
    expect(await db.boarding.count({ where: { departureId: departure.id } })).toBe(0);
    expect(await db.sale.count({ where: { passengerId: user.id } })).toBe(0);
    const after = await db.departure.findUniqueOrThrow({ where: { id: departure.id } });
    expect(after.occupiedSeats).toBe(0);
  });

  it("con saldo insuficiente no cobra y dice cuánto falta", async () => {
    const { actor } = await createBoardingDock(10);
    const { user, qr } = await createPassenger("0.50");

    const error = await board()({ qr }, actor).catch((e: BoardingError) => e);
    expect(error).toBeInstanceOf(BoardingError);
    expect((error as BoardingError).code).toBe("INSUFFICIENT_BALANCE");
    expect((error as BoardingError).details.shortfallCents).toBe(fareCents - 50);
    expect(await balanceOf(user.id)).toBe(50);
  });

  it("al llenarse la salida pasa a abordar la siguiente de la fila", async () => {
    const { dock, departure, actor } = await createBoardingDock(1);
    const nextVessel = await db.vessel.create({
      data: {
        code: uniq("N").slice(0, 10),
        name: "Lancha siguiente",
        kind: "BOAT",
        registration: uniq("MAT"),
        passengerCapacity: 5,
      },
    });
    const next = await db.departure.create({
      data: {
        vesselId: nextVessel.id,
        originDockId: dock.id,
        destinationDockId,
        status: "QUEUED",
        queuePosition: 1,
        passengerCapacity: 5,
      },
    });
    const first = await createPassenger("100.00");
    const second = await createPassenger("100.00");

    const confirmation = await board()({ qr: first.qr }, actor);
    expect(confirmation).toMatchObject({ seatNumber: 1, departureClosed: true });

    const closed = await db.departure.findUniqueOrThrow({ where: { id: departure.id } });
    const promoted = await db.departure.findUniqueOrThrow({ where: { id: next.id } });
    expect(closed.status).toBe("BOARDING_CLOSED");
    expect(promoted.status).toBe("BOARDING");
    expect(promoted.queuePosition).toBeNull();

    // El siguiente pasajero ya aborda la nueva embarcación, en su lugar 1.
    const nextConfirmation = await board()({ qr: second.qr }, actor);
    expect(nextConfirmation).toMatchObject({ seatNumber: 1, vesselName: "Lancha siguiente" });
  });

  it("el transbordador cobra por tipo de vehículo y ocupa su espacio", async () => {
    const { dock, actor } = await createBoardingDock(10);
    // Convertir la salida en transbordador con un tipo de vehículo propio de esta prueba.
    const type = await db.vehicleType.create({ data: { name: uniq("Tipo") } });
    const ferry = await db.vessel.create({
      data: {
        code: uniq("T").slice(0, 10),
        name: "Transbordador de prueba",
        kind: "FERRY",
        registration: uniq("MAT"),
        passengerCapacity: 10,
      },
    });
    await db.departure.updateMany({
      where: { originDockId: dock.id, status: "BOARDING" },
      data: { status: "CANCELLED" },
    });
    const departure = await db.departure.create({
      data: {
        vesselId: ferry.id,
        originDockId: dock.id,
        destinationDockId,
        status: "BOARDING",
        passengerCapacity: 10,
        vehicleCapacity: { create: { vehicleTypeId: type.id, capacity: 1 } },
      },
    });
    await db.fare.create({
      data: {
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: type.id,
        amount: "15.00",
        validFrom: new Date(Date.now() - 60_000),
        createdById: adminId,
      },
    });
    const owner = await createPassenger("100.00");
    const vehicle = await db.vehicle.create({
      data: {
        ownerId: owner.user.id,
        vehicleTypeId: type.id,
        brand: "Nissan",
        model: "Versa",
        color: "Gris",
        plate: uniq("P").slice(0, 15),
      },
    });
    const other = await createPassenger("100.00");
    await db.vehicle.create({
      data: {
        ownerId: other.user.id,
        vehicleTypeId: type.id,
        brand: "Ford",
        model: "Fiesta",
        color: "Rojo",
        plate: uniq("P").slice(0, 15),
      },
    });
    const otherVehicle = await db.vehicle.findFirstOrThrow({ where: { ownerId: other.user.id } });

    const choice = await board()({ qr: owner.qr, mode: "VEHICLE" }, actor).catch((e) => e);
    expect(choice.code).toBe("VEHICLE_CHOICE_REQUIRED");
    expect(choice.details.vehicles).toEqual([expect.objectContaining({ id: vehicle.id })]);

    const confirmation = await board()(
      { qr: owner.qr, mode: "VEHICLE", vehicleId: vehicle.id },
      actor,
    );
    expect(confirmation).toMatchObject({ fareCategory: "VEHICLE", amountCents: 1500 });
    const space = await db.departureVehicleCapacity.findUniqueOrThrow({
      where: { departureId_vehicleTypeId: { departureId: departure.id, vehicleTypeId: type.id } },
    });
    expect(space.occupied).toBe(1);

    // Ya no cabe otro vehículo de ese tipo: no se cobra.
    const full = await board()(
      { qr: other.qr, mode: "VEHICLE", vehicleId: otherVehicle.id },
      actor,
    ).catch((e) => e);
    expect(full.code).toBe("VEHICLE_SPACE_FULL");
    expect(await balanceOf(other.user.id)).toBe(10_000);
  });
});
