import { Money } from "@/domain/shared/money";

export interface RefundableBoardingTarget {
  id: string;
  saleId: string;
  saleChannel: "QR_BALANCE" | "TICKET_OFFICE";
  passengerId: string | null;
  seatNumber: number;
  amountCharged: string;
}

export interface RefundBoardingDeps {
  markCancelled: (params: { boardingId: string; cancelReason: string }) => Promise<void>;
  creditWallet: (params: {
    passengerId: string;
    saleId: string;
    amountPesos: string;
    reason: string;
  }) => Promise<void>;
  notify?: (params: { userId: string; title: string; body: string }) => Promise<void>;
}

export interface RefundBoardingParams {
  boarding: RefundableBoardingTarget;
  cancelReason: string;
  refundReason: string;
  notificationTitle: string;
  buildNotificationBody: (params: {
    seatNumber: number;
    amountFormatted: string;
    isWalletRefund: boolean;
  }) => string;
  notifiedUsers?: Set<string>;
}

export interface RefundBoardingOutcome {
  refundedToWallet: boolean;
  cashRefundReady: boolean;
  amountMoney: Money;
  amountDecimal: string;
}

export async function processBoardingRefund(
  deps: RefundBoardingDeps,
  params: RefundBoardingParams,
): Promise<RefundBoardingOutcome> {
  await deps.markCancelled({
    boardingId: params.boarding.id,
    cancelReason: params.cancelReason,
  });

  const amountMoney = Money.fromPesos(params.boarding.amountCharged);
  const amountDecimal = amountMoney.toDecimalString();
  const isWalletRefund =
    params.boarding.saleChannel === "QR_BALANCE" && Boolean(params.boarding.passengerId);

  if (isWalletRefund && params.boarding.passengerId) {
    await deps.creditWallet({
      passengerId: params.boarding.passengerId,
      saleId: params.boarding.saleId,
      amountPesos: amountDecimal,
      reason: params.refundReason,
    });
  }

  if (
    deps.notify &&
    params.boarding.passengerId &&
    (!params.notifiedUsers || !params.notifiedUsers.has(params.boarding.passengerId))
  ) {
    params.notifiedUsers?.add(params.boarding.passengerId);
    const body = params.buildNotificationBody({
      seatNumber: params.boarding.seatNumber,
      amountFormatted: amountMoney.format(),
      isWalletRefund,
    });
    await deps.notify({
      userId: params.boarding.passengerId,
      title: params.notificationTitle,
      body,
    });
  }

  return {
    refundedToWallet: isWalletRefund,
    cashRefundReady: !isWalletRefund,
    amountMoney,
    amountDecimal,
  };
}
