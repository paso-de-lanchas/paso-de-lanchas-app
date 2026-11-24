import { assertDepartureTransition } from "@/domain/departures/departure-state";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureBoardingForCancel, DepartureRecord, DepartureRepository } from "./ports";

export interface CancelDepartureInput {
  departureId: string;
  cancelReason: string;
  actorUserId: string;
  actorDockId?: string | null;
}

export interface PassengerRefundDetail {
  boardingId: string;
  passengerId: string | null;
  seatNumber: number;
  channel: "QR_BALANCE" | "TICKET_OFFICE";
  refundedAmount: string;
  refundMethod: "WALLET" | "CASH_BOX";
}

export interface CancelDepartureResult {
  departure: DepartureRecord;
  cancelledBoardingsCount: number;
  refundedBalanceCount: number;
  totalRefundedBalance: string;
  refundsByBoarding: PassengerRefundDetail[];
  cashRefundsReady: Array<{
    boardingId: string;
    saleId: string;
    seatNumber: number;
    amount: string;
  }>;
  notifiedPassengersCount: number;
}

export function createCancelDeparture(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
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

    if (!repo.unitOfWork) {
      throw new DomainError(
        "UNIT_OF_WORK_REQUIRED",
        "La operación de cancelación requiere una transacción atómica.",
      );
    }

    const uow = repo.unitOfWork;
    const initialDeparture = await repo.findDepartureById(departureId);
    if (!initialDeparture) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
    }

    if (input.actorDockId && input.actorDockId !== initialDeparture.originDockId) {
      throw new DomainError("DOCK_ACCESS_DENIED", "Solo puedes cancelar salidas de tu muelle.");
    }

    assertDepartureTransition(initialDeparture.status, "CANCELLED");

    const now = clock.now();

    const txResult = await uow.run(async (tx) => {
      const current = uow.lockDepartureForUpdate
        ? ((await uow.lockDepartureForUpdate(tx, departureId)) ?? initialDeparture)
        : initialDeparture;

      if (repo.findBoardingForUpdate) {
        await repo.findBoardingForUpdate(tx, current.originDockId);
      }

      if (input.actorDockId && input.actorDockId !== current.originDockId) {
        throw new DomainError("DOCK_ACCESS_DENIED", "Solo puedes cancelar salidas de tu muelle.");
      }

      assertDepartureTransition(current.status, "CANCELLED");

      const updatedDeparture = await uow.markDepartureCancelled(tx, {
        departureId: current.id,
        fromStatus: current.status,
        cancelReason,
      });

      const boardings: DepartureBoardingForCancel[] = await uow.listBoardingsForDeparture(
        tx,
        current.id,
      );
      const activeBoardings = boardings.filter((b) => b.status === "BOARDED");

      let refundedBalanceCount = 0;
      let refundSum = Money.zero();
      const refundsByBoarding: PassengerRefundDetail[] = [];
      const cashRefundsReady: Array<{
        boardingId: string;
        saleId: string;
        seatNumber: number;
        amount: string;
      }> = [];
      const notifiedUsers = new Set<string>();

      for (const boarding of activeBoardings) {
        await uow.markBoardingCancelled(tx, {
          boardingId: boarding.id,
          cancelReason,
        });

        const amountMoney = Money.fromPesos(boarding.amountCharged);
        const exactAmount = amountMoney.toDecimalString();

        if (boarding.saleChannel === "QR_BALANCE" && boarding.passengerId) {
          await uow.creditWalletRefund(tx, {
            passengerId: boarding.passengerId,
            boardingId: boarding.id,
            saleId: boarding.saleId,
            departureId: current.id,
            amountPesos: exactAmount,
            reason: `Reembolso por cancelación de salida: ${cancelReason}`,
            performedById: input.actorUserId,
          });
          refundedBalanceCount += 1;
          refundSum = refundSum.add(amountMoney);
          refundsByBoarding.push({
            boardingId: boarding.id,
            passengerId: boarding.passengerId,
            seatNumber: boarding.seatNumber,
            channel: boarding.saleChannel,
            refundedAmount: exactAmount,
            refundMethod: "WALLET",
          });
        } else {
          cashRefundsReady.push({
            boardingId: boarding.id,
            saleId: boarding.saleId,
            seatNumber: boarding.seatNumber,
            amount: exactAmount,
          });
          refundsByBoarding.push({
            boardingId: boarding.id,
            passengerId: boarding.passengerId,
            seatNumber: boarding.seatNumber,
            channel: boarding.saleChannel,
            refundedAmount: exactAmount,
            refundMethod: "CASH_BOX",
          });
        }

        if (boarding.passengerId && !notifiedUsers.has(boarding.passengerId)) {
          notifiedUsers.add(boarding.passengerId);
          const refundText =
            boarding.saleChannel === "QR_BALANCE"
              ? `Se reembolsaron ${amountMoney.format()} a tu monedero.`
              : `Tu boleto #${boarding.seatNumber} (${amountMoney.format()}) está listo para devolución en caja.`;

          await uow.createNotification(tx, {
            userId: boarding.passengerId,
            type: "DEPARTURE_CANCELLED",
            title: "Salida cancelada",
            body: `La salida fue cancelada (${cancelReason}). ${refundText}`,
          });
        }
      }

      return {
        departure: updatedDeparture,
        cancelledBoardingsCount: activeBoardings.length,
        refundedBalanceCount,
        totalRefundedBalance: refundSum.toDecimalString(),
        refundsByBoarding,
        cashRefundsReady,
        notifiedPassengersCount: notifiedUsers.size,
      };
    });

    if (auditLogger) {
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
          cancelledAt: now.toISOString(),
        },
      });
    }

    return txResult;
  };
}
