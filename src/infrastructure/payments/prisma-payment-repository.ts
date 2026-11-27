import type { ChangeAudit } from "@/application/shared/ports";
import type {
  PaymentRepository,
  TopUpLimits,
  VerifiedProviderPayment,
} from "@/application/payments/ports";
import type { OnlinePayment, OnlinePaymentStatus } from "@/domain/payments/online-payment";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toOnlinePayment(payment: {
  id: string;
  wallet: { userId: string };
  amount: { toString(): string };
  status: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
  idempotencyKey: string;
  providerPaymentId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}): OnlinePayment {
  return {
    id: payment.id,
    userId: payment.wallet.userId,
    amount: Money.fromPesos(payment.amount),
    status: payment.status === "REFUNDED" ? "REJECTED" : payment.status,
    idempotencyKey: payment.idempotencyKey,
    providerPaymentId: payment.providerPaymentId,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
  };
}

function auditData(audit: ChangeAudit) {
  return auditLogData({ ...audit, entity: "payments", entityId: null });
}

function isProviderPaymentIdCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  return JSON.stringify(error.meta?.target ?? "")
    .toLowerCase()
    .includes("provider_payment_id");
}

export class PrismaPaymentRepository implements PaymentRepository {
  private readonly wallets: PrismaWalletRepository;

  constructor(private readonly db: PrismaClient = prisma) {
    this.wallets = new PrismaWalletRepository(db);
  }

  async getTopUpLimits(): Promise<TopUpLimits> {
    const limits = await this.wallets.getTopUpLimits();
    return { minimum: limits.min, maximum: limits.max };
  }

  async createPending(payment: OnlinePayment): Promise<OnlinePayment> {
    const wallet = await this.db.wallet.findUnique({
      where: { userId: payment.userId },
      select: {
        id: true,
        user: { select: { role: true, status: true, deletedAt: true } },
      },
    });
    if (
      !wallet ||
      wallet.user.role !== "PASSENGER" ||
      wallet.user.status !== "ACTIVE" ||
      wallet.user.deletedAt !== null
    ) {
      throw new DomainError("PASSENGER_NOT_ACTIVE", "No se encontró un pasajero activo con saldo.");
    }

    const created = await this.db.payment.create({
      data: {
        id: payment.id,
        walletId: wallet.id,
        provider: "MERCADO_PAGO",
        idempotencyKey: payment.idempotencyKey,
        amount: payment.amount.toDecimalString(),
        status: "PENDING",
        createdAt: payment.createdAt,
      },
      include: { wallet: { select: { userId: true } } },
    });
    return toOnlinePayment(created);
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<OnlinePaymentStatus | null> {
    const payment = await this.db.payment.findFirst({
      where: {
        id: paymentId,
        provider: "MERCADO_PAGO",
        wallet: { is: { userId } },
      },
      select: { status: true },
    });
    if (!payment) return null;
    return payment.status === "REFUNDED" ? "REJECTED" : payment.status;
  }

  async processProviderPayment(
    providerPayment: VerifiedProviderPayment,
    confirmedAt: Date,
  ): Promise<"APPROVED" | "ALREADY_APPROVED" | "PENDING" | "REJECTED"> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          if (!isUuid(providerPayment.externalReference)) {
            await tx.auditLog.create({
              data: auditData({
                userId: null,
                action: "WEBHOOK_REJECTED",
                details: { reason: "INVALID_EXTERNAL_REFERENCE" },
              }),
            });
            return "REJECTED";
          }

          await tx.$executeRaw`
            SELECT id FROM "payments"
            WHERE id = ${providerPayment.externalReference}::uuid
            FOR UPDATE
          `;

          const payment = await tx.payment.findUnique({
            where: { id: providerPayment.externalReference },
            include: { wallet: { select: { userId: true } } },
          });
          if (!payment || payment.provider !== "MERCADO_PAGO") {
            await tx.auditLog.create({
              data: auditData({
                userId: null,
                action: "WEBHOOK_REJECTED",
                details: {
                  reason: "PAYMENT_NOT_FOUND",
                  externalReference: providerPayment.externalReference,
                },
              }),
            });
            return "REJECTED";
          }

          const expectedAmount = Money.fromPesos(payment.amount);
          if (
            !providerPayment.providerPaymentId ||
            providerPayment.providerPaymentId.length > 80 ||
            !expectedAmount.equals(providerPayment.amount)
          ) {
            await tx.auditLog.create({
              data: auditData({
                userId: null,
                action: "WEBHOOK_REJECTED",
                details: {
                  reason: "PAYMENT_DATA_MISMATCH",
                  paymentId: payment.id,
                  expectedAmountCents: expectedAmount.cents,
                  receivedAmountCents: providerPayment.amount.cents,
                },
              }),
            });
            return "REJECTED";
          }

          if (
            payment.providerPaymentId &&
            payment.providerPaymentId !== providerPayment.providerPaymentId
          ) {
            await tx.auditLog.create({
              data: auditData({
                userId: null,
                action: "WEBHOOK_REJECTED",
                details: { reason: "PROVIDER_PAYMENT_ID_MISMATCH", paymentId: payment.id },
              }),
            });
            return "REJECTED";
          }

          if (payment.status === "APPROVED") return "ALREADY_APPROVED";
          if (payment.status === "REJECTED" || payment.status === "REFUNDED") return "REJECTED";

          const existingPayment = await tx.payment.findUnique({
            where: { providerPaymentId: providerPayment.providerPaymentId },
            select: { id: true },
          });
          if (existingPayment && existingPayment.id !== payment.id) {
            await tx.auditLog.create({
              data: auditData({
                userId: null,
                action: "WEBHOOK_REJECTED",
                details: {
                  reason: "DUPLICATE_PROVIDER_PAYMENT_ID",
                  paymentId: payment.id,
                },
              }),
            });
            return "REJECTED";
          }

          if (providerPayment.status === "PENDING") {
            if (!payment.providerPaymentId) {
              await tx.payment.update({
                where: { id: payment.id },
                data: { providerPaymentId: providerPayment.providerPaymentId },
              });
            }
            return "PENDING";
          }

          if (providerPayment.status === "REJECTED") {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                providerPaymentId: providerPayment.providerPaymentId,
                status: "REJECTED",
                confirmedAt,
              },
            });
            await tx.auditLog.create({
              data: auditData({
                userId: payment.wallet.userId,
                action: "WEBHOOK_REJECTED",
                details: {
                  reason: "PROVIDER_PAYMENT_NOT_APPROVED",
                  paymentId: payment.id,
                  providerPaymentId: providerPayment.providerPaymentId,
                },
              }),
            });
            return "REJECTED";
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              providerPaymentId: providerPayment.providerPaymentId,
              status: "APPROVED",
              confirmedAt,
            },
          });
          await this.wallets.credit(
            tx,
            {
              userId: payment.wallet.userId,
              amount: expectedAmount,
              type: "TOPUP_ONLINE",
              performedById: payment.wallet.userId,
              at: confirmedAt,
              reason: "Recarga en línea con Mercado Pago",
              paymentId: payment.id,
            },
            {
              userId: payment.wallet.userId,
              action: "TOPUP_ONLINE_CONFIRMED",
              details: {
                paymentId: payment.id,
                providerPaymentId: providerPayment.providerPaymentId,
                amountCents: expectedAmount.cents,
              },
            },
          );
          return "APPROVED";
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10_000,
          timeout: 15_000,
        },
      );
    } catch (error) {
      if (!isProviderPaymentIdCollision(error)) throw error;
      await this.recordRejectedWebhook({
        userId: null,
        action: "WEBHOOK_REJECTED",
        details: { reason: "DUPLICATE_PROVIDER_PAYMENT_ID" },
      });
      return "REJECTED";
    }
  }

  async recordRejectedWebhook(audit: ChangeAudit): Promise<void> {
    await this.db.auditLog.create({ data: auditData(audit) });
  }
}
