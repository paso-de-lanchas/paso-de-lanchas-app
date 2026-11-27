import { describe, expect, it } from "vitest";

import { createPendingOnlinePayment } from "@/domain/payments/online-payment";
import { Money } from "@/domain/shared/money";

import { InMemoryPaymentRepository } from "./in-memory-payment-repository";

describe("InMemoryPaymentRepository", () => {
  function createRepository() {
    const repository = new InMemoryPaymentRepository({
      minimum: Money.fromPesos("20.00"),
      maximum: Money.fromPesos("500.00"),
    });
    return repository;
  }

  async function createPendingPayment(repository: InMemoryPaymentRepository) {
    await repository.createPending(
      createPendingOnlinePayment({
        id: "payment-id",
        userId: "passenger-id",
        amount: Money.fromPesos("50.00"),
        idempotencyKey: "idempotency-key",
        createdAt: new Date("2026-11-23T12:00:00.000Z"),
      }),
    );
  }

  it("credits an approved provider payment once and audits the credit", async () => {
    const repository = createRepository();
    await createPendingPayment(repository);
    const approval = {
      providerPaymentId: "provider-payment-id",
      externalReference: "payment-id",
      status: "APPROVED" as const,
      amount: Money.fromPesos("50.00"),
    };
    const confirmedAt = new Date("2026-11-23T12:05:00.000Z");

    await expect(repository.processProviderPayment(approval, confirmedAt)).resolves.toBe(
      "APPROVED",
    );
    await expect(repository.processProviderPayment(approval, confirmedAt)).resolves.toBe(
      "ALREADY_APPROVED",
    );
    expect(repository.getBalance("passenger-id")).toEqual(Money.fromPesos("50.00"));
    expect(repository.getPayment("payment-id")).toMatchObject({
      status: "APPROVED",
      providerPaymentId: "provider-payment-id",
      confirmedAt,
    });
    expect(repository.auditEntries).toHaveLength(1);
    expect(repository.auditEntries[0]).toMatchObject({ action: "TOPUP_ONLINE_CONFIRMED" });
  });

  it("does not credit pending or rejected payments", async () => {
    const repository = createRepository();
    await createPendingPayment(repository);

    await expect(
      repository.processProviderPayment(
        {
          providerPaymentId: "provider-payment-id",
          externalReference: "payment-id",
          status: "PENDING",
          amount: Money.fromPesos("50.00"),
        },
        new Date(),
      ),
    ).resolves.toBe("PENDING");
    await expect(
      repository.processProviderPayment(
        {
          providerPaymentId: "provider-payment-id",
          externalReference: "payment-id",
          status: "REJECTED",
          amount: Money.fromPesos("50.00"),
        },
        new Date(),
      ),
    ).resolves.toBe("REJECTED");

    expect(repository.getBalance("passenger-id")).toEqual(Money.zero());
    expect(repository.auditEntries).toMatchObject([
      {
        action: "WEBHOOK_REJECTED",
        details: { reason: "PROVIDER_PAYMENT_NOT_APPROVED" },
      },
    ]);
  });

  it("rejects mismatched amounts without changing the balance and records the rejection", async () => {
    const repository = createRepository();
    await createPendingPayment(repository);

    await expect(
      repository.processProviderPayment(
        {
          providerPaymentId: "provider-payment-id",
          externalReference: "payment-id",
          status: "APPROVED",
          amount: Money.fromPesos("49.99"),
        },
        new Date(),
      ),
    ).resolves.toBe("REJECTED");

    expect(repository.getBalance("passenger-id")).toEqual(Money.zero());
    expect(repository.auditEntries).toMatchObject([
      { action: "WEBHOOK_REJECTED", details: { reason: "PAYMENT_DATA_MISMATCH" } },
    ]);
  });

  it("does not treat a different provider payment as a duplicate approval", async () => {
    const repository = createRepository();
    await createPendingPayment(repository);
    await repository.processProviderPayment(
      {
        providerPaymentId: "provider-payment-id",
        externalReference: "payment-id",
        status: "APPROVED",
        amount: Money.fromPesos("50.00"),
      },
      new Date(),
    );

    await expect(
      repository.processProviderPayment(
        {
          providerPaymentId: "different-provider-payment-id",
          externalReference: "payment-id",
          status: "APPROVED",
          amount: Money.fromPesos("50.00"),
        },
        new Date(),
      ),
    ).resolves.toBe("REJECTED");
    expect(repository.getBalance("passenger-id")).toEqual(Money.fromPesos("50.00"));
    expect(repository.auditEntries).toMatchObject([
      { action: "TOPUP_ONLINE_CONFIRMED" },
      { action: "WEBHOOK_REJECTED", details: { reason: "APPROVED_PAYMENT_ID_MISMATCH" } },
    ]);
  });
});
