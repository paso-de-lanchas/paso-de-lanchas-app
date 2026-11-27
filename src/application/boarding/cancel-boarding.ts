import { z } from "zod";

import { parseInput } from "@/application/shared/input-error";
import { systemClock, type Clock } from "@/application/shared/ports";
import { assertCanCancelBoarding } from "@/domain/boarding/boarding-cancellation";
import { BoardingError } from "@/domain/boarding/boarding";
import { retryConcurrentUpdate } from "@/application/wallet/retry-concurrent-update";

import type { BoardingCancellationStore } from "./ports";

export const cancelBoardingSchema = z.object({
  boardingId: z.string().uuid("El abordaje no es válido."),
  reason: z.string().trim().min(1, "Escribe el motivo de la cancelación.").max(500),
});

export interface CancelBoardingActor {
  adminId: string;
  dockId: string | null;
  deviceId: string | null;
}

export function createCancelBoarding<Tx>(deps: {
  store: BoardingCancellationStore<Tx>;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function cancelBoarding(rawInput: unknown, actor: CancelBoardingActor) {
    const dockId = actor.dockId;
    const deviceId = actor.deviceId;
    if (!dockId) {
      throw new BoardingError("NO_DOCK_ASSIGNED", "Tu cuenta no tiene un muelle asignado.");
    }
    if (!deviceId) {
      throw new BoardingError(
        "AUTHORIZED_DEVICE_REQUIRED",
        "Cancela el abordaje desde una computadora autorizada del muelle.",
      );
    }

    const input = parseInput<"boardingId" | "reason", typeof cancelBoardingSchema>(
      cancelBoardingSchema,
      rawInput,
    );
    const at = clock.now();

    return retryConcurrentUpdate(() =>
      deps.store.run(async (tx) => {
        const boarding = await deps.store.lockBoardingForCancellation(tx, dockId, input.boardingId);
        if (!boarding) {
          throw new BoardingError(
            "BOARDING_NOT_FOUND",
            "No se encontró un abordaje activo de este muelle.",
          );
        }
        assertCanCancelBoarding(boarding.boardingStatus, boarding.departureStatus);
        await deps.store.cancelBoarding(tx, {
          boarding,
          adminId: actor.adminId,
          deviceId,
          reason: input.reason,
          at,
        });
        return {
          boardingId: boarding.boardingId,
          saleId: boarding.saleId,
          seatNumber: boarding.seatNumber,
          fareCategory: boarding.fareCategory,
          amountCents: boarding.amount.cents,
          paymentMethod: boarding.paymentMethod,
          reason: input.reason,
        };
      }),
    );
  };
}
