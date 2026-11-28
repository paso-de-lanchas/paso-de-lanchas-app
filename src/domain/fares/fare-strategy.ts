import type { DiscountRequestStatus, DiscountType } from "@/domain/account/discount";
import type { Money } from "@/domain/shared/money";

import type { FareCategory, VesselKind } from "./fare";

export interface FareOption {
  id: string;
  vesselKind: VesselKind;
  category: FareCategory;
  vehicleTypeId: number | null;
  amount: Money;
  validFrom: Date;
  validTo: Date | null;
}

export interface PassengerDiscount {
  type: DiscountType;
  status: DiscountRequestStatus;
  validUntil: Date | null;
}

export interface FareStrategyInput {
  vehicleTypeId?: number | null;
  discount?: PassengerDiscount | null;
}

export interface ResolvedFare {
  fareId: string;
  vesselKind: VesselKind;
  category: FareCategory;
  vehicleTypeId: number | null;
  amount: Money;
}

export interface FareStrategy {
  resolve(input: FareStrategyInput, fares: readonly FareOption[], at: Date): ResolvedFare;
}
