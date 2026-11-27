import type { Clock } from "@/application/shared/ports";

import type { PaymentGateway, PaymentRepository } from "./ports";

export interface ConfirmOnlinePaymentDeps {
  payments: PaymentRepository;
  gateway: PaymentGateway;
  clock: Clock;
}

export function createConfirmOnlinePayment(deps: ConfirmOnlinePaymentDeps) {
  return async function confirmOnlinePayment(
    headers: Parameters<PaymentGateway["verifyWebhook"]>[0],
  ) {
    const providerPayment = await deps.gateway.verifyWebhook(headers);
    if (!providerPayment) {
      await deps.payments.recordRejectedWebhook({
        userId: null,
        action: "WEBHOOK_REJECTED",
        details: { reason: "INVALID_SIGNATURE_OR_PAYMENT_DATA" },
      });
      return "REJECTED" as const;
    }

    return deps.payments.processProviderPayment(providerPayment, deps.clock.now());
  };
}
