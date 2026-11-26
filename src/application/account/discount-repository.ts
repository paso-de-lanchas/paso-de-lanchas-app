import type { DiscountRequest, DiscountType } from "@/domain/account/discount";

export interface PendingDiscountItem extends DiscountRequest {
  passengerName: string;
  passengerEmail: string;
}

export interface CreateDiscountRequestData {
  userId: string;
  discountType: DiscountType;
  credentialPhotoPath: string;
}

export interface DiscountRepository {
  findLatestByUserId(userId: string): Promise<DiscountRequest | null>;
  hasPendingByUserId(userId: string): Promise<boolean>;
  findById(requestId: string): Promise<DiscountRequest | null>;
  listPending(): Promise<PendingDiscountItem[]>;
  create(data: CreateDiscountRequestData): Promise<DiscountRequest>;
  approve(
    requestId: string,
    adminId: string,
    validUntil: Date,
    reviewedAt: Date,
  ): Promise<DiscountRequest>;
  reject(
    requestId: string,
    adminId: string,
    rejectionReason: string,
    reviewedAt: Date,
  ): Promise<DiscountRequest>;
  markExpiredBefore(now: Date): Promise<number>;
}
