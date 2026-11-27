import type { ChangeAudit } from "@/application/shared/ports";
import type { Money } from "@/domain/shared/money";
import type { OnlinePayment, OnlinePaymentStatus } from "@/domain/payments/online-payment";

export interface TopUpLimits {
  minimum: Money;
  maximum: Money;
}

export interface PaymentRepository {
  getTopUpLimits(): Promise<TopUpLimits>;
  createPending(payment: OnlinePayment): Promise<OnlinePayment>;
  getPaymentStatus(paymentId: string, userId: string): Promise<OnlinePaymentStatus | null>;
  /** Atomically records the provider result, wallet credit and confirmation audit when approved. */
  processProviderPayment(
    payment: VerifiedProviderPayment,
    confirmedAt: Date,
  ): Promise<"APPROVED" | "ALREADY_APPROVED" | "PENDING" | "REJECTED">;
  recordRejectedWebhook(audit: ChangeAudit): Promise<void>;
}

export interface CreateCheckoutInput {
  paymentId: string;
  idempotencyKey: string;
  amount: Money;
  payerEmail: string;
}

export interface PaymentWebhookHeaders {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}

export interface VerifiedProviderPayment {
  providerPaymentId: string;
  externalReference: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  amount: Money;
}

export interface PaymentGateway {
  createCheckout(input: CreateCheckoutInput): Promise<{ redirectUrl: string }>;
  verifyWebhook(headers: PaymentWebhookHeaders): Promise<VerifiedProviderPayment | null>;
}
