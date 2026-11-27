import { describe, expect, it, vi } from "vitest";

import type { PaymentGateway, PaymentRepository } from "@/application/payments/ports";
import { Money } from "@/domain/shared/money";

import { createConfirmOnlinePayment } from "./confirm-online-payment";

describe("createConfirmOnlinePayment", () => {
  const providerPayment = {
    providerPaymentId: "provider-payment-id",
    externalReference: "payment-id",
    status: "APPROVED" as const,
    amount: Money.fromPesos("50.00"),
  };
  const processProviderPayment = vi.fn(async () => "APPROVED" as const);
  const recordRejectedWebhook = vi.fn(async () => {});
  const payments: PaymentRepository = {
    getTopUpLimits: vi.fn(),
    createPending: vi.fn(),
    getPaymentStatus: vi.fn(),
    processProviderPayment,
    recordRejectedWebhook,
  };
  const verifyWebhook = vi.fn<PaymentGateway["verifyWebhook"]>(async () => providerPayment);
  const gateway: PaymentGateway = {
    createCheckout: vi.fn(),
    verifyWebhook,
  };

  it("processes a verified provider payment with the current time", async () => {
    const now = new Date("2026-11-23T12:00:00.000Z");
    const confirmOnlinePayment = createConfirmOnlinePayment({
      payments,
      gateway,
      clock: { now: () => now },
    });

    await expect(
      confirmOnlinePayment({ signature: "signed", requestId: "request-id", dataId: "123" }),
    ).resolves.toBe("APPROVED");
    expect(processProviderPayment).toHaveBeenCalledWith(providerPayment, now);
  });

  it("records invalid signatures as rejected and never processes a payment", async () => {
    verifyWebhook.mockResolvedValueOnce(null);
    processProviderPayment.mockClear();
    const confirmOnlinePayment = createConfirmOnlinePayment({
      payments,
      gateway,
      clock: { now: () => new Date() },
    });

    await expect(
      confirmOnlinePayment({ signature: "invalid", requestId: "request-id", dataId: "123" }),
    ).resolves.toBe("REJECTED");
    expect(recordRejectedWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WEBHOOK_REJECTED", userId: null }),
    );
    expect(processProviderPayment).not.toHaveBeenCalled();
  });
});
