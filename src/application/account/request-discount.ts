import { type DiscountRequest, isDiscountActive } from "@/domain/account/discount";
import { DomainError } from "@/domain/shared/domain-error";

import { requestDiscountSchema } from "./discount-input";
import type { DiscountRepository } from "./discount-repository";
import { expireDiscounts } from "./expire-discounts";

export async function requestDiscount(
  repo: DiscountRepository,
  userId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DiscountRequest> {
  await expireDiscounts(repo, now);

  const parsed = requestDiscountSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstMessage =
      parsed.error.issues[0]?.message ?? "Los datos de la solicitud no son válidos.";
    throw new DomainError("INVALID_DISCOUNT_REQUEST", firstMessage);
  }

  const alreadyPending = await repo.hasPendingByUserId(userId);
  if (alreadyPending) {
    throw new DomainError(
      "PENDING_DISCOUNT_EXISTS",
      "Ya tienes una solicitud de descuento en revisión.",
    );
  }

  const latest = await repo.findLatestByUserId(userId);
  if (latest && isDiscountActive(latest, now)) {
    throw new DomainError(
      "ACTIVE_DISCOUNT_EXISTS",
      "Ya cuentas con un descuento aprobado y vigente.",
    );
  }

  return repo.create({
    userId,
    discountType: parsed.data.discountType,
    credentialPhotoPath: parsed.data.credentialPhotoPath,
  });
}
