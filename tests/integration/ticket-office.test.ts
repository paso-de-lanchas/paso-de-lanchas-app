/**
 * Venta y cancelación de boletos contra PostgreSQL. Requiere `docker compose up -d` y
 * `npm run db:test:prepare`. Los datos se conservan para respetar la bitácora inmutable.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCancelBoarding } from "@/application/boarding/cancel-boarding";
import { createSellTickets } from "@/application/boarding/sell-tickets";
import { Money } from "@/domain/shared/money";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBoardingStore } from "@/infrastructure/boarding/prisma-boarding-store";
import { cryptoTicketCodeGenerator } from "@/infrastructure/boarding/crypto-ticket-code-generator";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;
const run = `${Math.random().toString(36).slice(2, 6)}${Date.now().toString(36).slice(-6)}`;
let seq = 0;
const uniq = (prefix: string) => `${prefix}${++seq}${run}`.slice(0, 30);

describe.skipIf(!prisma)("venta y cancelación de boletos en PostgreSQL", () => {
  const db = prisma!;
  let fareCents = 0;
  let fareId = "";

  async function createDock() {
    const code = uniq("T").slice(0, 10);
    return db.dock.create({
      data: { code, name: `Muelle ${code}`, latitude: "18.1", longitude: "-94.4" },
    });
  }

  async function createTicketOffice(capacity: number) {
    const [dock, destinationDock] = await Promise.all([createDock(), createDock()]);
    const admin = await db.user.create({
      data: {
        email: `${uniq("taq")}@pasolanchas.test`,
        fullName: "Admin de taquilla",
        passwordHash: "test-hash",
        role: "ADMIN",
        status: "ACTIVE",
        dockId: dock.id,
      },
    });
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
        name: "Lancha de taquilla",
        kind: "BOAT",
        registration: uniq("MAT"),
        passengerCapacity: capacity,
      },
    });
    const departure = await db.departure.create({
      data: {
        vesselId: vessel.id,
        originDockId: dock.id,
        destinationDockId: destinationDock.id,
        status: "BOARDING",
        passengerCapacity: capacity,
        boardingStartedAt: new Date(),
      },
    });
    return {
      departure,
      actor: { adminId: admin.id, dockId: dock.id, deviceId: device.id },
    };
  }

  const sell = (store = new PrismaBoardingStore(db)) =>
    createSellTickets({ store, ticketCodes: cryptoTicketCodeGenerator });

  beforeAll(async () => {
    await db.systemSetting.upsert({
      where: { key: "max_tickets_per_sale" },
      update: { value: 5 },
      create: { key: "max_tickets_per_sale", value: 5 },
    });
    const now = new Date();
    const currentFare = await db.fare.findFirst({
      where: {
        vesselKind: "BOAT",
        category: "GENERAL",
        vehicleTypeId: null,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    });
    if (currentFare) {
      fareCents = Money.fromPesos(currentFare.amount).cents;
      fareId = currentFare.id;
    } else {
      const creator = await db.user.create({
        data: {
          email: `${uniq("tar")}@pasolanchas.test`,
          fullName: "Tarifa de prueba",
          passwordHash: "test-hash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      const fare = await db.fare.create({
        data: {
          vesselKind: "BOAT",
          category: "GENERAL",
          amount: "10.00",
          validFrom: new Date(now.getTime() - 60_000),
          createdById: creator.id,
        },
      });
      fareCents = 1000;
      fareId = fare.id;
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("registra venta, lugares, caja, códigos y devolución en una sola transacción", async () => {
    const { departure, actor } = await createTicketOffice(5);
    const confirmation = await sell()({ tickets: [{ fareId }, { fareId }] }, actor);

    expect(confirmation.tickets.map((ticket) => ticket.seatNumber)).toEqual([1, 2]);
    expect(new Set(confirmation.tickets.map((ticket) => ticket.ticketCode)).size).toBe(2);
    expect(
      confirmation.tickets.every((ticket) => /^[A-HJ-NP-Z2-9]{12}$/.test(ticket.ticketCode)),
    ).toBe(true);

    const sale = await db.sale.findUniqueOrThrow({
      where: { id: confirmation.saleId },
    });
    expect(sale).toMatchObject({
      channel: "TICKET_OFFICE",
      paymentMethod: "CASH",
      ticketCount: 2,
    });
    expect(Money.fromPesos(sale.totalAmount).cents).toBe(fareCents * 2);
    expect(sale.cashShiftId).toBeTruthy();

    const cancellation = createCancelBoarding({ store: new PrismaBoardingStore(db) });
    const refund = await cancellation(
      { boardingId: confirmation.tickets[0].boardingId, reason: "Error de captura" },
      actor,
    );
    expect(refund.amountCents).toBe(fareCents);

    const [boardings, after, refundAudit] = await Promise.all([
      db.boarding.findMany({
        where: { departureId: departure.id },
        orderBy: { seatNumber: "asc" },
      }),
      db.departure.findUniqueOrThrow({ where: { id: departure.id } }),
      db.auditLog.findFirst({
        where: {
          action: "TICKET_OFFICE_CASH_REFUND",
          entity: "cash_shifts",
          entityId: sale.cashShiftId,
        },
      }),
    ]);
    expect(boardings.map((boarding) => boarding.status)).toEqual(["CANCELLED", "BOARDED"]);
    expect(boardings[0].cancelReason).toBe("Error de captura");
    expect(after.occupiedSeats).toBe(1);
    expect(refundAudit?.details).toMatchObject({
      boardingId: confirmation.tickets[0].boardingId,
      amountCents: fareCents,
      reason: "Error de captura",
    });
  });

  it("rechaza el lote completo si no hay lugares para todos", async () => {
    const { departure, actor } = await createTicketOffice(2);

    await expect(
      sell()(
        {
          tickets: [{ fareId }, { fareId }, { fareId }],
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "DEPARTURE_FULL" });

    expect(await db.boarding.count({ where: { departureId: departure.id } })).toBe(0);
    expect(await db.sale.count({ where: { registeredById: actor.adminId } })).toBe(0);
    expect(
      (await db.departure.findUniqueOrThrow({ where: { id: departure.id } })).occupiedSeats,
    ).toBe(0);
  });

  it("dos ventas simultáneas nunca exceden la capacidad", async () => {
    const { departure, actor } = await createTicketOffice(5);
    const results = await Promise.allSettled([
      sell()(
        {
          tickets: [{ fareId }, { fareId }, { fareId }],
        },
        actor,
      ),
      sell()(
        {
          tickets: [{ fareId }, { fareId }, { fareId }],
        },
        actor,
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const [boardings, after] = await Promise.all([
      db.boarding.findMany({ where: { departureId: departure.id } }),
      db.departure.findUniqueOrThrow({ where: { id: departure.id } }),
    ]);
    expect(boardings).toHaveLength(3);
    expect(after.occupiedSeats).toBe(3);
    expect(after.occupiedSeats).toBeLessThanOrEqual(after.passengerCapacity);
  });

  it("revierte venta, boletos y caja si falla la ocupación", async () => {
    const { departure, actor } = await createTicketOffice(5);
    class FailingStore extends PrismaBoardingStore {
      override async occupySeat(): Promise<never> {
        throw new Error("falla simulada al ocupar lugar");
      }
    }

    await expect(sell(new FailingStore(db))({ tickets: [{ fareId }] }, actor)).rejects.toThrow(
      "falla simulada al ocupar lugar",
    );

    expect(await db.boarding.count({ where: { departureId: departure.id } })).toBe(0);
    expect(await db.sale.count({ where: { registeredById: actor.adminId } })).toBe(0);
    expect(await db.cashShift.count({ where: { adminId: actor.adminId, closedAt: null } })).toBe(0);
    expect(
      (await db.departure.findUniqueOrThrow({ where: { id: departure.id } })).occupiedSeats,
    ).toBe(0);
  });
});
