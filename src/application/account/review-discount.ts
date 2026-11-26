import {
  type DiscountRequest,
  validateApprovalExpiration,
  validateRejectionReason,
} from "@/domain/account/discount";
import { DomainError } from "@/domain/shared/domain-error";

import { reviewDiscountSchema } from "./discount-input";
import type { DiscountRepository } from "./discount-repository";

export async function reviewDiscount(
  repo: DiscountRepository,
  adminId: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<DiscountRequest> {
  const parsed = reviewDiscountSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message ?? "Los datos de revisión no son válidos.";
    throw new DomainError("INVALID_DISCOUNT_REVIEW", firstMessage);
  }

  const existing = await repo.findById(parsed.data.requestId);
  if (!existing) {
    throw new DomainError(
      "DISCOUNT_REQUEST_NOT_FOUND",
      "No se encontró la solicitud de descuento.",
    );
  }

  if (existing.status !== "PENDING") {
    throw new DomainError(
      "DISCOUNT_ALREADY_REVIEWED",
      "Esta solicitud ya fue revisada anteriormente.",
    );
  }

  if (parsed.data.decision === "APPROVE") {
    validateApprovalExpiration(parsed.data.validUntil, now);
    return repo.approve(existing.id, adminId, parsed.data.validUntil, now);
  }

  const cleanReason = validateRejectionReason(parsed.data.rejectionReason);
  return repo.reject(existing.id, adminId, cleanReason, now);
}
