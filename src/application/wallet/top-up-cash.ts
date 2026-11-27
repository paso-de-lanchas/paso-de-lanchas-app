import type { Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import { parseInput } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import { validateTopUpAmount } from "@/domain/wallet/wallet";

import type { WalletRepository } from "./ports";
import { retryConcurrentUpdate } from "./retry-concurrent-update";
import { topUpCashSchema } from "./wallet-input";

export interface CashTopUpActor {
  adminId: string;
  deviceId: string;
}

export function createTopUpCash<TransactionContext>(deps: {
  repo: WalletRepository<TransactionContext>;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function topUpCash(rawInput: unknown, actor: CashTopUpActor) {
    const parsed = parseInput<"passengerId" | "amount", typeof topUpCashSchema>(
      topUpCashSchema,
      rawInput,
    );
    const passenger = await deps.repo.findPassengerById(parsed.passengerId);
    if (!passenger) {
      throw new DomainError(
        "PASSENGER_NOT_FOUND",
        "No se encontró un pasajero activo con monedero.",
      );
    }

    const amount = Money.fromPesos(parsed.amount);
    validateTopUpAmount(amount, await deps.repo.getTopUpLimits());
    const at = clock.now();

    const result = await retryConcurrentUpdate(() =>
      deps.repo.withTransaction(async (tx) => {
        const cashShiftId = await deps.repo.ensureOpenCashShift(tx, {
          adminId: actor.adminId,
          deviceId: actor.deviceId,
          at,
        });
        const transaction = await deps.repo.credit(
          tx,
          {
            userId: passenger.id,
            amount,
            type: "TOPUP_CASH",
            performedById: actor.adminId,
            at,
            reason: "Recarga en efectivo",
            cashShiftId,
          },
          {
            userId: actor.adminId,
            action: "WALLET_TOPUP_CASH",
            details: {
              passengerId: passenger.id,
              amountCents: amount.cents,
              cashShiftId,
            },
          },
        );
        return { transaction, cashShiftId };
      }),
    );

    return result.transaction;
  };
}
