import { describe, expect, it, vi } from "vitest";

import { processBoardingRefund } from "./refund-boarding";

describe("processBoardingRefund", () => {
  const baseParams = {
    boarding: {
      id: "boarding-1",
      saleId: "sale-1",
      saleChannel: "QR_BALANCE" as const,
      passengerId: "passenger-1",
      seatNumber: 12,
      amountCharged: "123.50",
    },
    cancelReason: "Incidente durante la operación",
    refundReason: "Reembolso por incidente",
    notificationTitle: "Salida cancelada por incidente",
    buildNotificationBody: ({
      seatNumber,
      amountFormatted,
      isWalletRefund,
    }: {
      seatNumber: number;
      amountFormatted: string;
      isWalletRefund: boolean;
    }) =>
      isWalletRefund
        ? `Asiento ${seatNumber}: se reembolsaron ${amountFormatted} a tu monedero.`
        : `Asiento ${seatNumber}: ${amountFormatted} está listo para devolución en caja.`,
  };

  it("reembolsa al monedero cuando la venta fue realizada con QR", async () => {
    const markCancelled = vi.fn(async () => {});
    const creditWallet = vi.fn(async () => {});
    const notify = vi.fn(async (params: { userId: string; title: string; body: string }) => {
      void params;
    });

    const result = await processBoardingRefund({ markCancelled, creditWallet, notify }, baseParams);

    expect(markCancelled).toHaveBeenCalledWith({
      boardingId: "boarding-1",
      cancelReason: "Incidente durante la operación",
    });

    expect(creditWallet).toHaveBeenCalledWith({
      passengerId: "passenger-1",
      saleId: "sale-1",
      amountPesos: "123.50",
      reason: "Reembolso por incidente",
    });

    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0]).toMatchObject({
      userId: "passenger-1",
      title: "Salida cancelada por incidente",
    });
    expect(notify.mock.calls[0][0].body).toContain("monedero");

    expect(result.refundedToWallet).toBe(true);
    expect(result.cashRefundReady).toBe(false);
    expect(result.amountDecimal).toBe("123.50");
    expect(result.amountMoney.toDecimalString()).toBe("123.50");
  });

  it("no deposita al monedero cuando la venta fue realizada en taquilla", async () => {
    const markCancelled = vi.fn(async () => {});
    const creditWallet = vi.fn(async () => {});
    const notify = vi.fn(async (params: { userId: string; title: string; body: string }) => {
      void params;
    });

    const result = await processBoardingRefund(
      { markCancelled, creditWallet, notify },
      {
        ...baseParams,
        boarding: {
          ...baseParams.boarding,
          saleChannel: "TICKET_OFFICE",
        },
      },
    );

    expect(markCancelled).toHaveBeenCalledOnce();
    expect(creditWallet).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0].body).toContain("caja");

    expect(result.refundedToWallet).toBe(false);
    expect(result.cashRefundReady).toBe(true);
    expect(result.amountDecimal).toBe("123.50");
  });

  it("no envía notificaciones duplicadas al mismo pasajero", async () => {
    const markCancelled = vi.fn(async () => {});
    const creditWallet = vi.fn(async () => {});
    const notify = vi.fn(async (params: { userId: string; title: string; body: string }) => {
      void params;
    });
    const notifiedUsers = new Set(["passenger-1"]);

    await processBoardingRefund(
      { markCancelled, creditWallet, notify },
      {
        ...baseParams,
        notifiedUsers,
      },
    );

    expect(markCancelled).toHaveBeenCalledOnce();
    expect(creditWallet).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });

  it("no intenta reembolsar ni notificar cuando no hay pasajero", async () => {
    const markCancelled = vi.fn(async () => {});
    const creditWallet = vi.fn(async () => {});
    const notify = vi.fn(async (params: { userId: string; title: string; body: string }) => {
      void params;
    });

    const result = await processBoardingRefund(
      { markCancelled, creditWallet, notify },
      {
        ...baseParams,
        boarding: {
          ...baseParams.boarding,
          passengerId: null,
        },
      },
    );

    expect(markCancelled).toHaveBeenCalledOnce();
    expect(creditWallet).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();

    expect(result.refundedToWallet).toBe(false);
    expect(result.cashRefundReady).toBe(true);
  });

  it("funciona sin proporcionar una función de notificación", async () => {
    const markCancelled = vi.fn(async () => {});
    const creditWallet = vi.fn(async () => {});

    const result = await processBoardingRefund({ markCancelled, creditWallet }, baseParams);

    expect(markCancelled).toHaveBeenCalledOnce();
    expect(creditWallet).toHaveBeenCalledOnce();
    expect(result.refundedToWallet).toBe(true);
  });
});
