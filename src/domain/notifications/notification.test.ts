import { describe, expect, it } from "vitest";

import {
  buildRechargeCreditedNotification,
  buildServiceAnnouncementNotification,
  buildTripCancelledRefundNotification,
  getNotificationCategoryLabel,
  NOTIFICATION_TYPES,
  partitionNotifications,
  type NotificationItem,
} from "./notification";

describe("dominio de notificaciones", () => {
  it("construye el mensaje de recarga acreditada en efectivo y en línea (RF-106)", () => {
    const cash = buildRechargeCreditedNotification({
      amountCents: 15000,
      method: "CASH",
      balanceAfterCents: 20050,
    });
    expect(cash.type).toBe(NOTIFICATION_TYPES.RECHARGE_CREDITED);
    expect(cash.title).toBe("Recarga acreditada");
    expect(cash.body).toContain("$150.00 MXN");
    expect(cash.body).toContain("en taquilla");
    expect(cash.body).toContain("$200.50 MXN");

    const online = buildRechargeCreditedNotification({
      amountCents: 5000,
      method: "ONLINE",
      balanceAfterCents: 5000,
    });
    expect(online.body).toContain("en línea");
  });

  it("construye notificaciones de aviso publicado y servicio suspendido (RF-107)", () => {
    const announcement = buildServiceAnnouncementNotification({
      title: "Horario extendido",
      message: "Hoy habrá cruces hasta las 23:00 h.",
      dockName: "Coatzacoalcos",
    });
    expect(announcement.type).toBe(NOTIFICATION_TYPES.SERVICE_ANNOUNCEMENT);
    expect(announcement.title).toBe("[Coatzacoalcos] Horario extendido");

    const suspended = buildServiceAnnouncementNotification({
      title: "Norte fuerte",
      message: "Puerto cerrado por Capitanía.",
      suspended: true,
    });
    expect(suspended.type).toBe(NOTIFICATION_TYPES.SERVICE_SUSPENDED);
    expect(suspended.title).toBe("Servicio suspendido: Norte fuerte");
  });

  it("construye la notificación de salida cancelada con reembolso (RF-108)", () => {
    const cancelled = buildTripCancelledRefundNotification({
      originDockName: "Coatzacoalcos",
      destinationDockName: "Villa Allende",
      refundAmountCents: 1500,
      reason: "Falla mecánica",
    });
    expect(cancelled.type).toBe(NOTIFICATION_TYPES.TRIP_CANCELLED_REFUND);
    expect(cancelled.body).toContain("Coatzacoalcos → Villa Allende");
    expect(cancelled.body).toContain("$15.00 MXN");
    expect(cancelled.body).toContain("Falla mecánica");
  });

  it("devuelve etiquetas de categoría incluso para tipos creados por otros módulos", () => {
    expect(getNotificationCategoryLabel("RECHARGE_CREDITED")).toBe("Saldo y recargas");
    expect(getNotificationCategoryLabel("SERVICE_ANNOUNCEMENT")).toBe("Aviso del servicio");
    expect(getNotificationCategoryLabel("SERVICE_SUSPENDED")).toBe("Suspensión de servicio");
    expect(getNotificationCategoryLabel("DEPARTURE_CANCELLED")).toBe("Viaje y reembolso");
    expect(getNotificationCategoryLabel("CUSTOM_TYPE")).toBe("Aviso");
  });

  it("separa leídas y no leídas ordenadas por fecha descendente y calcula el contador", () => {
    const items: NotificationItem[] = [
      {
        id: "1",
        userId: "u1",
        type: "RECHARGE_CREDITED",
        title: "Antigua no leída",
        body: "Cuerpo 1",
        readAt: null,
        createdAt: new Date("2026-11-27T10:00:00Z"),
      },
      {
        id: "2",
        userId: "u1",
        type: "SERVICE_ANNOUNCEMENT",
        title: "Leída",
        body: "Cuerpo 2",
        readAt: new Date("2026-11-27T11:05:00Z"),
        createdAt: new Date("2026-11-27T11:00:00Z"),
      },
      {
        id: "3",
        userId: "u1",
        type: "TRIP_CANCELLED_REFUND",
        title: "Reciente no leída",
        body: "Cuerpo 3",
        readAt: null,
        createdAt: new Date("2026-11-27T12:00:00Z"),
      },
    ];

    const result = partitionNotifications(items);
    expect(result.unreadCount).toBe(2);
    expect(result.unread.map((n) => n.id)).toEqual(["3", "1"]);
    expect(result.read.map((n) => n.id)).toEqual(["2"]);
  });
});
