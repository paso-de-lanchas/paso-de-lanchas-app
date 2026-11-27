import { parseInput } from "@/application/shared/input-error";
import type { WalletRepository } from "./ports";
import { transactionPageSchema } from "./wallet-input";

export function createListTransactions<TransactionContext>(
  repo: WalletRepository<TransactionContext>,
) {
  return async function listTransactions(userId: string, rawPage: unknown = 1) {
    const page = parseInput<"page", typeof transactionPageSchema>(transactionPageSchema, rawPage);
    return repo.listTransactions(userId, page);
  };
}
