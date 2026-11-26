import type { FareRepository } from "./ports";

export function createListCurrentFares(fares: FareRepository) {
  return (at: Date) => fares.listCurrentFares(at);
}
