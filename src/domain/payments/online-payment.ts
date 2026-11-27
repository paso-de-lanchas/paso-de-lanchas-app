import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export type OnlinePaymentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface OnlinePayment {
  id: string;
  userId: string;
  amount: Money;
  status: OnlinePaymentStatus;
  idempotencyKey: string;
  providerPaymentId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface NewOnlinePayment {
  id: string;
  userId: string;
  amount: Money;
  idempotencyKey: string;
  createdAt: Date;
}

export function createPendingOnlinePayment(input: NewOnlinePayment): OnlinePayment {
  if (input.amount.isNegative() || input.amount.equals(Money.zero())) {
    throw new DomainError(
      "INVALID_PAYMENT_AMOUNT",
      "El monto de la recarga debe ser mayor que cero.",
    );
  }

  return {
    ...input,
    status: "PENDING",
    providerPaymentId: null,
    confirmedAt: null,
  };
}
