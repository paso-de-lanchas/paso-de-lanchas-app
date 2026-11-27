import { parseInput } from "@/application/shared/input-error";

import type { PassengerWalletSummary, WalletRepository } from "./ports";
import { searchPassengerSchema } from "./wallet-input";

export function createSearchPassenger<TransactionContext>(
  repo: WalletRepository<TransactionContext>,
) {
  return async function searchPassenger(rawInput: unknown): Promise<PassengerWalletSummary | null> {
    const parsed = parseInput<"contact", typeof searchPassengerSchema>(
      searchPassengerSchema,
      rawInput,
    );
    return repo.findPassengerByContact(parsed.contact);
  };
}
