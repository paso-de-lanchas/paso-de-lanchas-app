import type { FareRepository } from "./ports";

export function createListFareHistory(fares: FareRepository) {
  return () => fares.listFareHistory();
}
