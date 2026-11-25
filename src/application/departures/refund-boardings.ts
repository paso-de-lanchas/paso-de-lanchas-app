import { Money } from "@/domain/shared/money";
import type {
  CashRefundRecordInput,
  CreateNotificationInput,
  DepartureBoardingForCancel,
  RefundPassengerInput,
} from "./ports";

export interface PassengerRefundDetail {
  boardingId: string;
  passengerId: string | null;
  seatNumber: number;
  channel: "QR_BALANCE" | "TICKET_OFFICE";
  refundedAmount: string;
  refundMethod: "WALLET" | "CASH_BOX";
}

export interface CashRefundItem {
  boardingId: string;
  saleId: string;
  seatNumber: number;
  amount: string;
}

export interface RefundBoardingsTxOps {
  markBoardingCancelled(
    tx: unknown,
    params: { boardingId: string; cancelReason: string },
  ): Promise<void>;
  creditWalletRefund(tx: unknown, input: RefundPassengerInput): Promise<void>;
  recordCashRefund(tx: unknown, input: CashRefundRecordInput): Promise<void>;
  createNotification(tx: unknown, input: CreateNotificationInput): Promise<void>;
}

export interface RefundBoardingsSummary {
  cancelledBoardingsCount: number;
  refundedBalanceCount: number;
  totalRefundedBalance: string;
  refundsByBoarding: PassengerRefundDetail[];
  cashRefundsReady: CashRefundItem[];
  notifiedPassengersCount: number;
}

export async function processBoardingRefunds(
  tx: unknown,
  ops: RefundBoardingsTxOps,
  params: {
    boardings: DepartureBoardingForCancel[];
    departureId: string | null;
    reason: string;
    reasonPrefix: string;
    notificationType: string;
    notificationTitle: string;
    actorUserId: string;
  },
): Promise<RefundBoardingsSummary> {
  const activeBoardings = params.boardings.filter((b) => b.status === "BOARDED");

  let refundedBalanceCount = 0;
  let refundSum = Money.zero();
  const refundsByBoarding: PassengerRefundDetail[] = [];
  const cashRefundsReady: CashRefundItem[] = [];
  const notifiedUsers = new Set<string>();

  for (const boarding of activeBoardings) {
    await ops.markBoardingCancelled(tx, {
      boardingId: boarding.id,
      cancelReason: params.reason,
    });

    const amountMoney = Money.fromPesos(boarding.amountCharged);
    const exactAmount = amountMoney.toDecimalString();

    if (boarding.saleChannel === "QR_BALANCE" && boarding.passengerId) {
      await ops.creditWalletRefund(tx, {
        passengerId: boarding.passengerId,
        boardingId: boarding.id,
        saleId: boarding.saleId,
        departureId: params.departureId ?? "",
        amountPesos: exactAmount,
        reason: `${params.reasonPrefix}: ${params.reason}`,
        performedById: params.actorUserId,
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
      await ops.recordCashRefund(tx, {
        boardingId: boarding.id,
        saleId: boarding.saleId,
        departureId: params.departureId,
        passengerId: boarding.passengerId,
        seatNumber: boarding.seatNumber,
        amountPesos: exactAmount,
        reason: `${params.reasonPrefix}: ${params.reason}`,
        performedById: params.actorUserId,
      });
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

      await ops.createNotification(tx, {
        userId: boarding.passengerId,
        type: params.notificationType,
        title: params.notificationTitle,
        body: `${params.notificationTitle} (${params.reason}). ${refundText}`,
      });
    }
  }

  return {
    cancelledBoardingsCount: activeBoardings.length,
    refundedBalanceCount,
    totalRefundedBalance: refundSum.toDecimalString(),
    refundsByBoarding,
    cashRefundsReady,
    notifiedPassengersCount: notifiedUsers.size,
  };
}
