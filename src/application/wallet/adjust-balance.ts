import type { ChangeAudit, Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import { parseInput } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import type { WalletRepository } from "./ports";
import { retryConcurrentUpdate } from "./retry-concurrent-update";
import { adjustBalanceSchema } from "./wallet-input";

export function createAdjustBalance<TransactionContext>(deps: {
  repo: WalletRepository<TransactionContext>;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function adjustBalance(rawInput: unknown, adminId: string) {
    const parsed = parseInput<
      "passengerId" | "type" | "direction" | "amount" | "reason",
      typeof adjustBalanceSchema
    >(adjustBalanceSchema, rawInput);
    const passenger = await deps.repo.findPassengerById(parsed.passengerId);
    if (!passenger) {
      throw new DomainError(
        "PASSENGER_NOT_FOUND",
        "No se encontró un pasajero activo con monedero.",
      );
    }
    if (parsed.type === "REFUND" && parsed.direction !== "CREDIT") {
      throw new DomainError("INVALID_REFUND_DIRECTION", "Un reembolso debe abonarse al monedero.");
    }

    const amount = Money.fromPesos(parsed.amount);
    const at = clock.now();
    const audit: ChangeAudit = {
      userId: adminId,
      action: parsed.type === "REFUND" ? "WALLET_REFUND" : "WALLET_ADJUSTED",
      details: {
        passengerId: passenger.id,
        amountCents: parsed.direction === "CREDIT" ? amount.cents : -amount.cents,
        reason: parsed.reason,
      },
    };
    const transaction = await retryConcurrentUpdate(() =>
      deps.repo.withTransaction((tx) => {
        const input = {
          userId: passenger.id,
          amount,
          type: parsed.type,
          performedById: adminId,
          at,
          reason: parsed.reason,
        };
        return parsed.direction === "CREDIT"
          ? deps.repo.credit(tx, input, audit)
          : deps.repo.debit(tx, input, audit);
      }),
    );

    return transaction;
  };
}
