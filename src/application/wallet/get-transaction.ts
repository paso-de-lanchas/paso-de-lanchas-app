import { parseInput } from "@/application/shared/input-error";

import type { WalletRepository } from "./ports";
import { transactionIdSchema } from "./wallet-input";

export function createGetTransaction<TransactionContext>(
  repo: WalletRepository<TransactionContext>,
) {
  return async function getTransaction(rawId: unknown) {
    const { id } = parseInput<"id", typeof transactionIdSchema>(transactionIdSchema, {
      id: rawId,
    });
    return repo.findTransactionById(id);
  };
}
