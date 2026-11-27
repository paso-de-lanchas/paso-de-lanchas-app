import { isDiscountActive } from "@/domain/account/discount";

import { resolveCurrentFare } from "./fare-strategy-helpers";
import type { FareOption, FareStrategy, FareStrategyInput, ResolvedFare } from "./fare-strategy";

/**
 * Lancha: tarifa general, o la de estudiante / INAPAM si el pasajero tiene un descuento
 * aprobado y vigente al momento de abordar. La vigencia usa la MISMA regla que la revisión de
 * descuentos (`isDiscountActive`, hora de México): el dinero no puede tener dos versiones.
 */
export class BoatFareStrategy implements FareStrategy {
  resolve(input: FareStrategyInput, fares: readonly FareOption[], at: Date): ResolvedFare {
    const discount = input.discount;
    const category = discount && isDiscountActive(discount, at) ? discount.type : "GENERAL";
    return resolveCurrentFare(fares, "BOAT", category, null, at);
  }
}
