import { assertDepartureTransition } from "@/domain/departures/departure-state";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { CashRefundItem, PassengerRefundDetail } from "./refund-boardings";
import { processBoardingRefunds } from "./refund-boardings";
import { createStartNextBoarding } from "./start-next-boarding";
import type { DepartureRecord, DepartureRepository } from "./ports";

export type { PassengerRefundDetail, CashRefundItem };

export interface CancelDepartureInput {
  departureId: string;
  cancelReason: string;
  actorUserId: string;
  actorDockId?: string | null;
}

export interface CancelDepartureResult {
  departure: DepartureRecord;
  cancelledBoardingsCount: number;
  refundedBalanceCount: number;
  totalRefundedBalance: string;
  refundsByBoarding: PassengerRefundDetail[];
  cashRefundsReady: CashRefundItem[];
  notifiedPassengersCount: number;
  nextBoarding: DepartureRecord | null;
}

export function createCancelDeparture(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  const startNextBoarding = createStartNextBoarding(repo, clock, auditLogger);

  return async function cancelDeparture(
    input: CancelDepartureInput,
  ): Promise<CancelDepartureResult> {
    const departureId = input.departureId.trim();
    const cancelReason = input.cancelReason.trim();

    if (!departureId) {
      throw new DomainError(
        "INVALID_DEPARTURE_ID",
        "El identificador de la salida es obligatorio.",
      );
    }

    if (!cancelReason) {
      throw new DomainError(
        "CANCEL_REASON_REQUIRED",
        "Debes indicar un motivo obligatorio para cancelar la salida.",
      );
    }

    const uow = repo.unitOfWork;
    const initialDeparture = await repo.findDepartureById(departureId);
    if (!initialDeparture) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
    }

    if (!input.actorDockId || input.actorDockId !== initialDeparture.originDockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y operar únicamente desde tu muelle.",
      );
    }

    assertDepartureTransition(initialDeparture.status, "CANCELLED");

    const now = clock.now();

    const txResult = await uow.run(async (tx) => {
      const current = uow.lockDepartureForUpdate
        ? ((await uow.lockDepartureForUpdate(tx, departureId)) ?? initialDeparture)
        : initialDeparture;

      if (!input.actorDockId || input.actorDockId !== current.originDockId) {
        throw new DomainError(
          "DOCK_ACCESS_DENIED",
          "Debes tener un muelle asignado y operar únicamente desde tu muelle.",
        );
      }

      assertDepartureTransition(current.status, "CANCELLED");

      const updatedDeparture = await uow.markDepartureCancelled(tx, {
        departureId: current.id,
        fromStatus: current.status,
        cancelReason,
      });

      const boardings = await uow.listBoardingsForDeparture(tx, current.id);
      const refundSummary = await processBoardingRefunds(
        tx,
        {
          markBoardingCancelled: uow.markBoardingCancelled.bind(uow),
          creditWalletRefund: uow.creditWalletRefund.bind(uow),
          recordCashRefund: uow.recordCashRefund.bind(uow),
          createNotification: uow.createNotification.bind(uow),
        },
        {
          boardings,
          departureId: current.id,
          reason: cancelReason,
          reasonPrefix: "Reembolso por cancelación de salida",
          notificationType: "DEPARTURE_CANCELLED",
          notificationTitle: "Salida cancelada",
          actorUserId: input.actorUserId,
        },
      );

      return {
        departure: updatedDeparture,
        wasBoarding: current.status === "BOARDING",
        ...refundSummary,
      };
    });

    const nextBoarding = txResult.wasBoarding
      ? await startNextBoarding(txResult.departure.originDockId, input.actorUserId).catch(
          async () => null,
        )
      : null;

    await auditLogger.log({
      userId: input.actorUserId,
      action: "DEPARTURE_CANCELLED",
      entity: "departures",
      entityId: txResult.departure.id,
      details: {
        cancelReason,
        cancelledBoardingsCount: txResult.cancelledBoardingsCount,
        refundedBalanceCount: txResult.refundedBalanceCount,
        totalRefundedBalance: txResult.totalRefundedBalance,
        refundsByBoarding: txResult.refundsByBoarding,
        cashRefundsCount: txResult.cashRefundsReady.length,
        notifiedPassengersCount: txResult.notifiedPassengersCount,
        nextBoardingId: nextBoarding?.id ?? null,
        cancelledAt: now.toISOString(),
      },
    });

    return {
      departure: txResult.departure,
      cancelledBoardingsCount: txResult.cancelledBoardingsCount,
      refundedBalanceCount: txResult.refundedBalanceCount,
      totalRefundedBalance: txResult.totalRefundedBalance,
      refundsByBoarding: txResult.refundsByBoarding,
      cashRefundsReady: txResult.cashRefundsReady,
      notifiedPassengersCount: txResult.notifiedPassengersCount,
      nextBoarding,
    };
  };
}
