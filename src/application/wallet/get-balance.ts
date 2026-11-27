import type { Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import type { WalletRepository } from "./ports";

export interface WalletBalanceResult {
  balanceCents: number;
  currentGeneralFareCents: number | null;
  belowGeneralFare: boolean;
}

export function createGetBalance<TransactionContext>(deps: {
  repo: WalletRepository<TransactionContext>;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;
  return async function getBalance(userId: string): Promise<WalletBalanceResult> {
    const wallet = await deps.repo.findByUserId(userId);
    if (!wallet) {
      throw new DomainError("WALLET_NOT_FOUND", "No se encontró el monedero del pasajero.");
    }

    const fare = await deps.repo.getCurrentGeneralBoatFare(clock.now());
    return {
      balanceCents: wallet.balanceCents,
      currentGeneralFareCents: fare?.cents ?? null,
      belowGeneralFare: fare !== null && wallet.balanceCents < fare.cents,
    };
  };
}
