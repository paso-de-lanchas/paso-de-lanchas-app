import { DomainError } from "@/domain/shared/domain-error";

export type DiscountType = "STUDENT" | "INAPAM";

export type DiscountRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

const MEXICO_UTC_OFFSET_HOURS = 6;

export interface DiscountRequest {
  id: string;
  userId: string;
  discountType: DiscountType;
  credentialPhotoPath: string;
  status: DiscountRequestStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  validUntil: Date | null;
  createdAt: Date;
}

export function getMexicoTodayUtcMidnight(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() - MEXICO_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function getMexicoExpirationDeadline(validUntil: Date): Date {
  return new Date(
    Date.UTC(
      validUntil.getUTCFullYear(),
      validUntil.getUTCMonth(),
      validUntil.getUTCDate() + 1,
      MEXICO_UTC_OFFSET_HOURS,
      0,
      0,
      0,
    ),
  );
}

export function validateApprovalExpiration(validUntil: Date, now: Date = new Date()): void {
  if (Number.isNaN(validUntil.getTime())) {
    throw new DomainError(
      "INVALID_EXPIRATION_DATE",
      "La fecha de vencimiento del descuento debe ser futura.",
    );
  }

  const expirationDateUtc = Date.UTC(
    validUntil.getUTCFullYear(),
    validUntil.getUTCMonth(),
    validUntil.getUTCDate(),
  );
  const todayMexicoUtc = getMexicoTodayUtcMidnight(now).getTime();

  if (expirationDateUtc <= todayMexicoUtc) {
    throw new DomainError(
      "INVALID_EXPIRATION_DATE",
      "La fecha de vencimiento del descuento debe ser futura.",
    );
  }
}

export function validateRejectionReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new DomainError("REJECTION_REASON_REQUIRED", "Debes indicar el motivo del rechazo.");
  }
  return trimmed;
}

export function isDiscountActive(
  request: Pick<DiscountRequest, "status" | "validUntil">,
  at: Date = new Date(),
): boolean {
  if (request.status !== "APPROVED" || !request.validUntil) {
    return false;
  }
  const deadline = getMexicoExpirationDeadline(request.validUntil);
  return at.getTime() < deadline.getTime();
}

export function getDiscountTypeLabel(type: DiscountType): string {
  return type === "STUDENT" ? "Estudiante" : "INAPAM";
}

export function getDiscountStatusLabel(status: DiscountRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "En revisión";
    case "APPROVED":
      return "Aprobada";
    case "REJECTED":
      return "Rechazada";
    case "EXPIRED":
      return "Vencida";
  }
}
