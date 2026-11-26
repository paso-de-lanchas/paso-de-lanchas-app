import { randomBytes } from "node:crypto";

import type { PasswordHasher } from "@/application/auth/ports";
import { type Clock, systemClock } from "@/application/shared/ports";
import {
  type BalanceForfeitureWarning,
  buildBalanceForfeitureWarning,
  ensureAccountCanBeCancelled,
} from "@/domain/account/account-cancellation";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { cancelAccountSchema } from "./cancel-account-input";

export interface AccountCancellationSummary {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  status: string;
  deletedAt: Date | null;
  balanceCents: number;
}

export interface ExecuteAccountCancellationParams {
  userId: string;
  randomPasswordHash: string;
  revokedAt: Date;
  acknowledgeBalanceLoss: boolean;
}

export interface ExecuteAccountCancellationResult {
  forfeitedBalanceCents: number;
}

export interface AccountCancellationRepository {
  findAccountSummaryById(userId: string): Promise<AccountCancellationSummary | null>;
  executeCancellation(
    params: ExecuteAccountCancellationParams,
  ): Promise<ExecuteAccountCancellationResult>;
}

export interface AccountCancellationPreview {
  userId: string;
  email: string;
  fullName: string;
  warning: BalanceForfeitureWarning;
}

export async function getAccountCancellationPreview(
  repo: AccountCancellationRepository,
  userId: string,
): Promise<AccountCancellationPreview> {
  const summary = await repo.findAccountSummaryById(userId);
  if (!summary) {
    throw new DomainError("ACCOUNT_NOT_FOUND", "No se encontró la cuenta del pasajero.");
  }

  ensureAccountCanBeCancelled(summary);
  const balance = Money.fromCents(summary.balanceCents);

  return {
    userId: summary.id,
    email: summary.email,
    fullName: summary.fullName,
    warning: buildBalanceForfeitureWarning(balance),
  };
}

export interface CancelAccountDeps {
  repo: AccountCancellationRepository;
  passwordHasher: PasswordHasher;
  clock?: Clock;
  generateRandomSecret?: () => string;
}

export interface CancelAccountResult {
  cancelledAt: Date;
  forfeitedBalanceCents: number;
}

export function createCancelAccount(deps: CancelAccountDeps) {
  const clock = deps.clock ?? systemClock;
  const generateRandomSecret = deps.generateRandomSecret ?? (() => randomBytes(32).toString("hex"));

  return async function cancelAccount(
    userId: string,
    rawInput: unknown,
  ): Promise<CancelAccountResult> {
    const parsed = cancelAccountSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMessage =
        parsed.error.issues[0]?.message ?? "Los datos de confirmación no son válidos.";
      throw new DomainError("INVALID_CANCELLATION_INPUT", firstMessage);
    }

    const summary = await deps.repo.findAccountSummaryById(userId);
    if (!summary) {
      throw new DomainError("ACCOUNT_NOT_FOUND", "No se encontró la cuenta del pasajero.");
    }

    ensureAccountCanBeCancelled(summary);

    const passwordMatches = await deps.passwordHasher.verify(
      summary.passwordHash,
      parsed.data.currentPassword,
    );
    if (!passwordMatches) {
      throw new DomainError("INVALID_PASSWORD", "La contraseña no es correcta.");
    }

    const previewBalance = Money.fromCents(summary.balanceCents);
    if (previewBalance.cents > 0 && !parsed.data.acknowledgeBalanceLoss) {
      throw new DomainError(
        "BALANCE_ACKNOWLEDGEMENT_REQUIRED",
        `Tienes un saldo de ${previewBalance.format()}. Confirma que aceptas perderlo antes de cancelar tu cuenta.`,
      );
    }

    const now = clock.now();
    const randomPasswordHash = await deps.passwordHasher.hash(generateRandomSecret());

    const { forfeitedBalanceCents } = await deps.repo.executeCancellation({
      userId,
      randomPasswordHash,
      revokedAt: now,
      acknowledgeBalanceLoss: parsed.data.acknowledgeBalanceLoss,
    });

    return {
      cancelledAt: now,
      forfeitedBalanceCents,
    };
  };
}
