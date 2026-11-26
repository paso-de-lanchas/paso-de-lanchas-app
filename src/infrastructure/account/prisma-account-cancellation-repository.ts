import type {
  AccountCancellationRepository,
  AccountCancellationSummary,
  ExecuteAccountCancellationParams,
  ExecuteAccountCancellationResult,
} from "@/application/account/cancel-account";
import {
  buildAnonymizedAccountData,
  ensureAccountCanBeCancelled,
} from "@/domain/account/account-cancellation";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import { prisma } from "@/infrastructure/db/prisma";

export class PrismaAccountCancellationRepository implements AccountCancellationRepository {
  async findAccountSummaryById(userId: string): Promise<AccountCancellationSummary | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        wallet: {
          select: {
            balance: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const balanceCents = user.wallet ? Money.fromPesos(user.wallet.balance).cents : 0;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      status: user.status,
      deletedAt: user.deletedAt,
      balanceCents,
    };
  }

  async executeCancellation(
    params: ExecuteAccountCancellationParams,
  ): Promise<ExecuteAccountCancellationResult> {
    return prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({
        where: { id: params.userId },
        select: {
          status: true,
          deletedAt: true,
          wallet: {
            select: {
              balance: true,
            },
          },
        },
      });

      if (!freshUser) {
        throw new DomainError("ACCOUNT_NOT_FOUND", "No se encontró la cuenta del pasajero.");
      }

      ensureAccountCanBeCancelled(freshUser);

      const balance = freshUser.wallet ? Money.fromPesos(freshUser.wallet.balance) : Money.zero();
      if (balance.cents > 0 && !params.acknowledgeBalanceLoss) {
        throw new DomainError(
          "BALANCE_ACKNOWLEDGEMENT_REQUIRED",
          `Tienes un saldo de ${balance.format()}. Confirma que aceptas perderlo antes de cancelar tu cuenta.`,
        );
      }

      const anonymizedData = buildAnonymizedAccountData(
        params.userId,
        params.randomPasswordHash,
        params.revokedAt,
      );

      await tx.user.update({
        where: { id: params.userId },
        data: {
          deletedAt: anonymizedData.deletedAt,
          status: anonymizedData.status,
          fullName: anonymizedData.fullName,
          email: anonymizedData.email,
          phone: anonymizedData.phone,
          photoUrl: anonymizedData.photoUrl,
          passwordHash: anonymizedData.passwordHash,
        },
      });

      await tx.qrCredential.updateMany({
        where: {
          userId: params.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: params.revokedAt,
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: params.userId,
        },
      });

      await tx.authToken.deleteMany({
        where: {
          userId: params.userId,
        },
      });

      await tx.pushSubscription.deleteMany({
        where: {
          userId: params.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "ACCOUNT_CANCELLED",
          entity: "user",
          entityId: params.userId,
          details: {
            forfeitedBalanceCents: balance.cents,
          },
        },
      });

      return {
        forfeitedBalanceCents: balance.cents,
      };
    });
  }
}
