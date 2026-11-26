import type { DiscountRequest } from "@/domain/account/discount";

import type { DiscountRepository } from "./discount-repository";
import { expireDiscounts } from "./expire-discounts";

export async function getMyDiscount(
  repo: DiscountRepository,
  userId: string,
  now: Date = new Date(),
): Promise<DiscountRequest | null> {
  await expireDiscounts(repo, now);
  return repo.findLatestByUserId(userId);
}
