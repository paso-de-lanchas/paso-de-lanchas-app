import type { WalletRepository } from "./ports";

export function createGetTopUpLimits<TransactionContext>(
  repo: WalletRepository<TransactionContext>,
) {
  return async function getTopUpLimits() {
    const limits = await repo.getTopUpLimits();
    return { minCents: limits.min.cents, maxCents: limits.max.cents };
  };
}
