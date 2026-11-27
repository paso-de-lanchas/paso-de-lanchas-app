import { dateKeyInMexico, dateKeyUtc, resolveCurrentFare } from "./fare-strategy-helpers";
import type {
  FareOption,
  FareStrategy,
  FareStrategyInput,
  PassengerDiscount,
  ResolvedFare,
} from "./fare-strategy";

function isDiscountCurrent(
  discount: PassengerDiscount | null | undefined,
  at: Date,
): discount is PassengerDiscount {
  if (!discount || discount.status !== "APPROVED") return false;
  if (discount.validUntil === null) return true;

  const validUntil = dateKeyUtc(discount.validUntil);
  const boardingDate = dateKeyInMexico(at);
  return validUntil !== null && boardingDate !== null && validUntil >= boardingDate;
}

export class BoatFareStrategy implements FareStrategy {
  resolve(input: FareStrategyInput, fares: readonly FareOption[], at: Date): ResolvedFare {
    const discount = input.discount;
    const category = isDiscountCurrent(discount, at) ? discount.type : "GENERAL";
    return resolveCurrentFare(fares, "BOAT", category, null, at);
  }
}
