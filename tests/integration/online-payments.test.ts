/**
 * Confirma que el webhook y el crédito al monedero comparten una transacción PostgreSQL.
 * Requiere `docker compose up -d` y `npm run db:test:prepare`.
 */
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPendingOnlinePayment } from "@/domain/payments/online-payment";
import { Money } from "@/domain/shared/money";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPaymentRepository } from "@/infrastructure/payments/prisma-payment-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("recargas en línea con PostgreSQL", () => {
  const db = prisma!;
  const repository = new PrismaPaymentRepository(db);
  const suffix = randomUUID();
  let passengerId = "";
  let email = "";

  beforeAll(async () => {
    email = `online-payment-${suffix}@pasolanchas.test`;
    const passenger = await db.user.create({
      data: {
        email,
        fullName: "Pasajero de recarga en línea",
        passwordHash: "test-hash",
        role: "PASSENGER",
        status: "ACTIVE",
      },
    });
    passengerId = passenger.id;
    await db.wallet.create({ data: { userId: passenger.id } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function createPendingPayment(amount = "50.00") {
    return repository.createPending(
      createPendingOnlinePayment({
        id: randomUUID(),
        userId: passengerId,
        amount: Money.fromPesos(amount),
        idempotencyKey: randomUUID(),
        createdAt: new Date(),
      }),
    );
  }

  it("persists a pending payment and scopes status to its passenger", async () => {
    const payment = await createPendingPayment();

    expect(await repository.getPaymentStatus(payment.id, passengerId)).toBe("PENDING");
    expect(await repository.getPaymentStatus(payment.id, randomUUID())).toBeNull();
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      walletId: (await db.wallet.findUniqueOrThrow({ where: { userId: passengerId } })).id,
      provider: "MERCADO_PAGO",
      status: "PENDING",
      providerPaymentId: null,
    });
  });

  it("credits only once when an approved webhook is delivered concurrently", async () => {
    const payment = await createPendingPayment();
    const approved = {
      providerPaymentId: randomUUID(),
      externalReference: payment.id,
      status: "APPROVED" as const,
      amount: payment.amount,
    };

    const results = await Promise.all([
      repository.processProviderPayment(approved, new Date()),
      repository.processProviderPayment(approved, new Date()),
    ]);

    expect(results.sort()).toEqual(["ALREADY_APPROVED", "APPROVED"]);
    expect(await repository.getPaymentStatus(payment.id, passengerId)).toBe("APPROVED");
    const wallet = await db.wallet.findUniqueOrThrow({ where: { userId: passengerId } });
    const transactions = await db.walletTransaction.findMany({
      where: { paymentId: payment.id },
    });
    expect(Money.fromPesos(wallet.balance)).toEqual(Money.fromPesos("50.00"));
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: "TOPUP_ONLINE",
      performedById: passengerId,
    });
    expect(
      await db.auditLog.count({
        where: {
          action: "TOPUP_ONLINE_CONFIRMED",
          entity: "wallet_transactions",
          entityId: transactions[0].id,
        },
      }),
    ).toBe(1);
  });

  it("does not credit pending or rejected provider payments", async () => {
    const payment = await createPendingPayment();
    const providerPaymentId = randomUUID();

    expect(
      await repository.processProviderPayment(
        {
          providerPaymentId,
          externalReference: payment.id,
          status: "PENDING",
          amount: payment.amount,
        },
        new Date(),
      ),
    ).toBe("PENDING");
    expect(
      await repository.processProviderPayment(
        {
          providerPaymentId,
          externalReference: payment.id,
          status: "REJECTED",
          amount: payment.amount,
        },
        new Date(),
      ),
    ).toBe("REJECTED");

    expect(await repository.getPaymentStatus(payment.id, passengerId)).toBe("REJECTED");
    expect(await db.walletTransaction.count({ where: { paymentId: payment.id } })).toBe(0);
    expect(
      await db.auditLog.count({
        where: {
          action: "WEBHOOK_REJECTED",
          details: { path: ["paymentId"], equals: payment.id },
        },
      }),
    ).toBeGreaterThan(0);
  });

  it("rolls back approval if the passenger cannot receive a wallet credit", async () => {
    const payment = await createPendingPayment();
    const approved = {
      providerPaymentId: randomUUID(),
      externalReference: payment.id,
      status: "APPROVED" as const,
      amount: payment.amount,
    };
    await db.user.update({ where: { id: passengerId }, data: { deletedAt: new Date() } });

    await expect(repository.processProviderPayment(approved, new Date())).rejects.toMatchObject({
      code: "PASSENGER_NOT_ACTIVE",
    });
    expect(await repository.getPaymentStatus(payment.id, passengerId)).toBe("PENDING");
    expect(await db.walletTransaction.count({ where: { paymentId: payment.id } })).toBe(0);
  });
});
