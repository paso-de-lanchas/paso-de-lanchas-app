import type { DiscountRepository } from "./discount-repository";

export async function expireDiscounts(
  repo: DiscountRepository,
  now: Date = new Date(),
): Promise<number> {
  return repo.markExpiredBefore(now);
}
