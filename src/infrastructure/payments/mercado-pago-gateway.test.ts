import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { Payment, Preference } from "mercadopago";

import { Money } from "@/domain/shared/money";

import { createMercadoPagoGateway } from "./mercado-pago-gateway";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMercadoPagoGateway", () => {
  const secret = "test-webhook-secret";

  function signWebhook(dataId: string, requestId: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const hash = createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${timestamp},v1=${hash}`;
  }

  it("rejects an unsigned notification without querying Mercado Pago", async () => {
    const gateway = createMercadoPagoGateway({
      accessToken: "TEST-access-token",
      webhookSecret: secret,
      appUrl: "https://example.test",
    });

    await expect(
      gateway.verifyWebhook({ signature: null, requestId: null, dataId: "123" }),
    ).resolves.toBeNull();
  });

  it("verifies the signature and fetches the payment from Mercado Pago", async () => {
    const providerPayment = {
      api_response: { status: 200, headers: ["content-type", ["application/json"]] },
      id: 123,
      external_reference: "payment-id",
      status: "approved",
      transaction_amount: 50,
      currency_id: "MXN",
    } satisfies Awaited<ReturnType<Payment["get"]>>;
    const getPayment = vi.spyOn(Payment.prototype, "get").mockResolvedValueOnce(providerPayment);
    const gateway = createMercadoPagoGateway({
      accessToken: "TEST-access-token",
      webhookSecret: secret,
      appUrl: "https://example.test",
    });
    const headers = {
      signature: signWebhook("123", "request-id"),
      requestId: "request-id",
      dataId: "123",
    };

    await expect(gateway.verifyWebhook(headers)).resolves.toMatchObject({
      providerPaymentId: "123",
      externalReference: "payment-id",
      status: "APPROVED",
      amount: Money.fromPesos("50.00"),
    });
    expect(getPayment).toHaveBeenCalledWith({ id: "123" });
  });

  it("uses the sandbox Checkout Pro link and correlates it to the pending payment", async () => {
    const createPreference = vi.spyOn(Preference.prototype, "create").mockResolvedValueOnce({
      api_response: { status: 201, headers: ["content-type", ["application/json"]] },
      sandbox_init_point: "https://sandbox.mercadopago.test/checkout",
    });
    const gateway = createMercadoPagoGateway({
      accessToken: "TEST-access-token",
      webhookSecret: secret,
      appUrl: "https://example.test",
    });

    await expect(
      gateway.createCheckout({
        paymentId: "payment-id",
        idempotencyKey: "idempotency-key",
        amount: Money.fromPesos("50.00"),
        payerEmail: "passenger@example.test",
      }),
    ).resolves.toEqual({ redirectUrl: "https://sandbox.mercadopago.test/checkout" });
    expect(createPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          external_reference: "payment-id",
          payer: { email: "passenger@example.test" },
          items: [expect.objectContaining({ currency_id: "MXN", unit_price: 50 })],
        }),
        requestOptions: { idempotencyKey: "idempotency-key" },
      }),
    );
  });

  it("reports missing credentials instead of allowing an unconfigured checkout", async () => {
    const gateway = createMercadoPagoGateway({
      accessToken: undefined,
      webhookSecret: undefined,
      appUrl: "http://localhost:3000",
    });

    await expect(
      gateway.createCheckout({
        paymentId: "payment-id",
        idempotencyKey: "idempotency-key",
        amount: Money.fromPesos("50.00"),
        payerEmail: "passenger@example.test",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_CONFIGURATION_MISSING" });
    await expect(
      gateway.verifyWebhook({ signature: "signature", requestId: "request", dataId: "123" }),
    ).rejects.toMatchObject({ code: "PAYMENT_CONFIGURATION_MISSING" });
  });

  it("refuses a non-test Access Token", async () => {
    const gateway = createMercadoPagoGateway({
      accessToken: "APP_USR-live-token",
      webhookSecret: secret,
      appUrl: "https://example.test",
    });

    await expect(
      gateway.createCheckout({
        paymentId: "payment-id",
        idempotencyKey: "idempotency-key",
        amount: Money.fromPesos("50.00"),
        payerEmail: "passenger@example.test",
      }),
    ).rejects.toMatchObject({ code: "TEST_CREDENTIALS_REQUIRED" });
  });
});
