import type { DiscountRepository, PendingDiscountItem } from "./discount-repository";
import { expireDiscounts } from "./expire-discounts";

export async function listPendingDiscounts(
  repo: DiscountRepository,
  now: Date = new Date(),
): Promise<PendingDiscountItem[]> {
  await expireDiscounts(repo, now);
  return repo.listPending();
}
