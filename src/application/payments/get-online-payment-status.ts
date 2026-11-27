import { z } from "zod";

import type { PaymentRepository } from "./ports";

const paymentIdSchema = z.string().uuid();

export function createGetOnlinePaymentStatus(
  payments: Pick<PaymentRepository, "getPaymentStatus">,
) {
  return async function getOnlinePaymentStatus(paymentId: unknown, userId: string) {
    const parsed = paymentIdSchema.safeParse(paymentId);
    if (!parsed.success) return null;
    return payments.getPaymentStatus(parsed.data, userId);
  };
}
