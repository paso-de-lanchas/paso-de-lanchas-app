import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Clock } from "@/application/shared/ports";
import { createPendingOnlinePayment } from "@/domain/payments/online-payment";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import type { PaymentGateway, PaymentRepository } from "./ports";

const startOnlineTopUpInputSchema = z.object({
  amount: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un monto válido con hasta dos decimales."),
});

export interface StartOnlineTopUpDeps {
  payments: PaymentRepository;
  gateway: PaymentGateway;
  clock: Clock;
  newId?: () => string;
}

export function createStartOnlineTopUp(deps: StartOnlineTopUpDeps) {
  const newId = deps.newId ?? randomUUID;

  return async function startOnlineTopUp(input: unknown, userId: string, payerEmail: string) {
    const parsed = startOnlineTopUpInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_TOP_UP_AMOUNT",
        parsed.error.issues[0]?.message ?? "Revisa el monto de la recarga.",
      );
    }

    const amount = Money.fromPesos(parsed.data.amount);
    const { minimum, maximum } = await deps.payments.getTopUpLimits();
    if (minimum.isNegative() || minimum.equals(Money.zero()) || maximum.isLessThan(minimum)) {
      throw new DomainError(
        "INVALID_TOP_UP_LIMITS",
        "Los límites de recarga están configurados incorrectamente.",
      );
    }
    if (amount.isLessThan(minimum) || maximum.isLessThan(amount)) {
      throw new DomainError(
        "TOP_UP_OUT_OF_RANGE",
        `El monto debe estar entre ${minimum.format()} y ${maximum.format()}.`,
      );
    }

    const payment = createPendingOnlinePayment({
      id: newId(),
      userId,
      amount,
      idempotencyKey: newId(),
      createdAt: deps.clock.now(),
    });
    const savedPayment = await deps.payments.createPending(payment);
    const checkout = await deps.gateway.createCheckout({
      paymentId: savedPayment.id,
      idempotencyKey: savedPayment.idempotencyKey,
      amount: savedPayment.amount,
      payerEmail,
    });

    return { paymentId: savedPayment.id, redirectUrl: checkout.redirectUrl };
  };
}
