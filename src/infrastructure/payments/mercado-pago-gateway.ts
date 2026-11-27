import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Payment,
  Preference,
  WebhookSignatureValidator,
} from "mercadopago";

import type {
  CreateCheckoutInput,
  PaymentGateway,
  PaymentWebhookHeaders,
  VerifiedProviderPayment,
} from "@/application/payments/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export interface MercadoPagoGatewayConfig {
  accessToken: string | undefined;
  webhookSecret: string | undefined;
  appUrl: string;
}

function paymentStatus(status: string): VerifiedProviderPayment["status"] {
  if (status === "approved") return "APPROVED";
  if (status === "pending" || status === "in_process" || status === "authorized") {
    return "PENDING";
  }
  return "REJECTED";
}

function getClient(accessToken: string | undefined): MercadoPagoConfig {
  if (!accessToken) {
    throw new DomainError(
      "PAYMENT_CONFIGURATION_MISSING",
      "Configura MP_ACCESS_TOKEN para habilitar las recargas en línea.",
    );
  }
  if (!accessToken.startsWith("TEST-")) {
    throw new DomainError(
      "TEST_CREDENTIALS_REQUIRED",
      "Las recargas de este entorno solo aceptan un Access Token de prueba de Mercado Pago.",
    );
  }
  return new MercadoPagoConfig({ accessToken });
}

export function createMercadoPagoGateway(config: MercadoPagoGatewayConfig): PaymentGateway {
  return {
    async createCheckout(input: CreateCheckoutInput) {
      const client = getClient(config.accessToken);
      const preference = await new Preference(client).create({
        body: {
          external_reference: input.paymentId,
          notification_url: `${config.appUrl}/api/payments/webhook`,
          back_urls: {
            success: `${config.appUrl}/pasajero/saldo/recargar?paymentId=${input.paymentId}&estado=success`,
            pending: `${config.appUrl}/pasajero/saldo/recargar?paymentId=${input.paymentId}&estado=pending`,
            failure: `${config.appUrl}/pasajero/saldo/recargar?paymentId=${input.paymentId}&estado=failure`,
          },
          items: [
            {
              id: input.paymentId,
              title: "Recarga de saldo",
              quantity: 1,
              currency_id: "MXN",
              unit_price: Number(input.amount.toDecimalString()),
            },
          ],
          payer: { email: input.payerEmail },
        },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      });

      if (!preference.sandbox_init_point) {
        throw new Error("Mercado Pago no devolvió la URL segura de Checkout Pro de prueba.");
      }
      return { redirectUrl: preference.sandbox_init_point };
    },

    async verifyWebhook(headers: PaymentWebhookHeaders) {
      if (!config.webhookSecret) {
        throw new DomainError(
          "PAYMENT_CONFIGURATION_MISSING",
          "Configura MP_WEBHOOK_SECRET para validar las notificaciones de pago.",
        );
      }

      try {
        WebhookSignatureValidator.validate({
          xSignature: headers.signature,
          xRequestId: headers.requestId,
          dataId: headers.dataId,
          secret: config.webhookSecret,
          toleranceSeconds: 300,
        });
      } catch (error) {
        if (error instanceof InvalidWebhookSignatureError) return null;
        throw error;
      }

      if (!headers.dataId) return null;

      const providerPayment = await new Payment(getClient(config.accessToken)).get({
        id: headers.dataId,
      });
      if (
        providerPayment.id === undefined ||
        providerPayment.external_reference === undefined ||
        providerPayment.status === undefined ||
        providerPayment.transaction_amount === undefined ||
        providerPayment.currency_id !== "MXN" ||
        !Number.isFinite(providerPayment.transaction_amount) ||
        providerPayment.transaction_amount <= 0
      ) {
        return null;
      }

      return {
        providerPaymentId: String(providerPayment.id),
        externalReference: providerPayment.external_reference,
        status: paymentStatus(providerPayment.status),
        amount: Money.fromPesos(providerPayment.transaction_amount),
      };
    },
  };
}
