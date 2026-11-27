import type { ChangeAudit } from "@/application/shared/ports";
import type {
  PaymentRepository,
  TopUpLimits,
  VerifiedProviderPayment,
} from "@/application/payments/ports";
import { type OnlinePayment, type OnlinePaymentStatus } from "@/domain/payments/online-payment";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, OnlinePayment>();
  private readonly balances = new Map<string, Money>();
  private readonly audits: ChangeAudit[] = [];

  constructor(private readonly limits: TopUpLimits) {}

  get auditEntries(): readonly ChangeAudit[] {
    return this.audits;
  }

  async getTopUpLimits(): Promise<TopUpLimits> {
    return this.limits;
  }

  async createPending(payment: OnlinePayment): Promise<OnlinePayment> {
    if (
      this.payments.has(payment.id) ||
      [...this.payments.values()].some((saved) => saved.idempotencyKey === payment.idempotencyKey)
    ) {
      throw new DomainError("DUPLICATE_PAYMENT", "La recarga ya fue registrada.");
    }

    this.payments.set(payment.id, payment);
    if (!this.balances.has(payment.userId)) this.balances.set(payment.userId, Money.zero());
    return payment;
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<OnlinePaymentStatus | null> {
    const payment = this.payments.get(paymentId);
    return payment?.userId === userId ? payment.status : null;
  }

  async processProviderPayment(
    providerPayment: VerifiedProviderPayment,
    confirmedAt: Date,
  ): Promise<"APPROVED" | "ALREADY_APPROVED" | "PENDING" | "REJECTED"> {
    const payment = this.payments.get(providerPayment.externalReference);
    if (!payment) {
      await this.recordRejectedWebhook({
        userId: null,
        action: "WEBHOOK_REJECTED",
        details: {
          reason: "PAYMENT_NOT_FOUND",
          externalReference: providerPayment.externalReference,
        },
      });
      return "REJECTED";
    }

    const providerIdUsed = [...this.payments.values()].some(
      (saved) =>
        saved.providerPaymentId === providerPayment.providerPaymentId && saved.id !== payment.id,
    );
    if (
      !providerPayment.providerPaymentId ||
      providerIdUsed ||
      !payment.amount.equals(providerPayment.amount)
    ) {
      await this.recordRejectedWebhook({
        userId: null,
        action: "WEBHOOK_REJECTED",
        details: {
          reason: providerIdUsed ? "DUPLICATE_PROVIDER_PAYMENT_ID" : "PAYMENT_DATA_MISMATCH",
          paymentId: payment.id,
        },
      });
      return "REJECTED";
    }

    if (payment.status === "APPROVED") {
      if (payment.providerPaymentId === providerPayment.providerPaymentId)
        return "ALREADY_APPROVED";
      await this.recordRejectedWebhook({
        userId: null,
        action: "WEBHOOK_REJECTED",
        details: { reason: "APPROVED_PAYMENT_ID_MISMATCH", paymentId: payment.id },
      });
      return "REJECTED";
    }
    if (payment.status === "REJECTED") return "REJECTED";
    if (providerPayment.status === "PENDING") return "PENDING";

    if (providerPayment.status === "REJECTED") {
      this.payments.set(payment.id, {
        ...payment,
        status: "REJECTED",
        providerPaymentId: providerPayment.providerPaymentId,
        confirmedAt,
      });
      this.audits.push({
        userId: payment.userId,
        action: "WEBHOOK_REJECTED",
        details: {
          reason: "PROVIDER_PAYMENT_NOT_APPROVED",
          paymentId: payment.id,
          providerPaymentId: providerPayment.providerPaymentId,
        },
      });
      return "REJECTED";
    }

    const balance = this.balances.get(payment.userId);
    if (!balance) {
      throw new DomainError("WALLET_NOT_FOUND", "No se encontró el monedero del pasajero.");
    }

    this.payments.set(payment.id, {
      ...payment,
      status: "APPROVED",
      providerPaymentId: providerPayment.providerPaymentId,
      confirmedAt,
    });
    this.balances.set(payment.userId, balance.add(payment.amount));
    this.audits.push({
      userId: payment.userId,
      action: "TOPUP_ONLINE_CONFIRMED",
      details: {
        paymentId: payment.id,
        providerPaymentId: providerPayment.providerPaymentId,
        amount: payment.amount.toDecimalString(),
      },
    });
    return "APPROVED";
  }

  async recordRejectedWebhook(audit: ChangeAudit): Promise<void> {
    this.audits.push(audit);
  }

  getBalance(userId: string): Money {
    return this.balances.get(userId) ?? Money.zero();
  }

  getPayment(paymentId: string): OnlinePayment | null {
    const payment = this.payments.get(paymentId);
    return payment ? { ...payment } : null;
  }
}
