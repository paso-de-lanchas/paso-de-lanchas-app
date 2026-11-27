import { describe, expect, it, vi } from "vitest";

import type { PaymentGateway, PaymentRepository } from "@/application/payments/ports";
import { Money } from "@/domain/shared/money";

import { createStartOnlineTopUp } from "./start-online-top-up";

describe("createStartOnlineTopUp", () => {
  const now = new Date("2026-11-23T12:00:00.000Z");
  const payment = {
    id: "payment-id",
    userId: "passenger-id",
    amount: Money.fromPesos("50.00"),
    status: "PENDING" as const,
    idempotencyKey: "idempotency-key",
    providerPaymentId: null,
    createdAt: now,
    confirmedAt: null,
  };
  const createPending = vi.fn(async () => payment);
  const getTopUpLimits = vi.fn(async () => ({
    minimum: Money.fromPesos("20.00"),
    maximum: Money.fromPesos("500.00"),
  }));
  const createCheckout = vi.fn(async () => ({ redirectUrl: "https://checkout.test/" }));
  const payments: PaymentRepository = {
    getTopUpLimits,
    createPending,
    getPaymentStatus: vi.fn(),
    processProviderPayment: vi.fn(),
    recordRejectedWebhook: vi.fn(),
  };
  const gateway: PaymentGateway = {
    createCheckout,
    verifyWebhook: vi.fn(),
  };

  it("persists a pending payment before creating the checkout", async () => {
    const callOrder: string[] = [];
    createPending.mockImplementation(async () => {
      callOrder.push("persist");
      return payment;
    });
    createCheckout.mockImplementation(async () => {
      callOrder.push("checkout");
      return { redirectUrl: "https://checkout.test/" };
    });
    const startOnlineTopUp = createStartOnlineTopUp({
      payments,
      gateway,
      clock: { now: () => now },
      newId: vi.fn().mockReturnValueOnce("payment-id").mockReturnValueOnce("idempotency-key"),
    });

    await expect(
      startOnlineTopUp({ amount: "50.00" }, "passenger-id", "passenger@example.test"),
    ).resolves.toEqual({
      paymentId: "payment-id",
      redirectUrl: "https://checkout.test/",
    });

    expect(callOrder).toEqual(["persist", "checkout"]);
    expect(createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "payment-id",
        idempotencyKey: "idempotency-key",
        amount: Money.fromPesos("50.00"),
        status: "PENDING",
      }),
    );
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-id",
        idempotencyKey: "idempotency-key",
        payerEmail: "passenger@example.test",
      }),
    );
  });

  it.each(["19.99", "500.01", "-1", "abc"])(
    "rejects out-of-range or malformed amount %s",
    async (amount) => {
      const startOnlineTopUp = createStartOnlineTopUp({
        payments,
        gateway,
        clock: { now: () => now },
      });
      createPending.mockClear();
      createCheckout.mockClear();

      await expect(
        startOnlineTopUp({ amount }, "passenger-id", "passenger@example.test"),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/^INVALID_TOP_UP_AMOUNT$|^TOP_UP_OUT_OF_RANGE$/),
      });
      expect(createPending).not.toHaveBeenCalled();
      expect(createCheckout).not.toHaveBeenCalled();
    },
  );

  it("leaves the persisted payment pending if checkout creation fails", async () => {
    createPending.mockResolvedValue(payment);
    createCheckout.mockRejectedValueOnce(new Error("Mercado Pago no disponible"));
    const startOnlineTopUp = createStartOnlineTopUp({
      payments,
      gateway,
      clock: { now: () => now },
    });

    await expect(
      startOnlineTopUp({ amount: "50.00" }, "passenger-id", "passenger@example.test"),
    ).rejects.toThrow("Mercado Pago no disponible");
    expect(createPending).toHaveBeenCalledOnce();
  });
});
