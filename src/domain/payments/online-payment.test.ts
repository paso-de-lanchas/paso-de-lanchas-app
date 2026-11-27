import { describe, expect, it } from "vitest";

import { Money } from "@/domain/shared/money";

import { createPendingOnlinePayment } from "./online-payment";

describe("createPendingOnlinePayment", () => {
  const paymentInput = {
    id: "payment-id",
    userId: "passenger-id",
    amount: Money.fromPesos("50.00"),
    idempotencyKey: "idempotency-key",
    createdAt: new Date("2026-11-23T12:00:00.000Z"),
  };

  it("creates a pending payment without provider confirmation", () => {
    expect(createPendingOnlinePayment(paymentInput)).toEqual({
      ...paymentInput,
      status: "PENDING",
      providerPaymentId: null,
      confirmedAt: null,
    });
  });

  it.each(["0.00", "-1.00"])("rejects a non-positive amount (%s)", (amount) => {
    expect(() =>
      createPendingOnlinePayment({ ...paymentInput, amount: Money.fromPesos(amount) }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYMENT_AMOUNT" }));
  });
});
