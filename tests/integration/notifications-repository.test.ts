/**
 * Notificaciones in-app en PostgreSQL (#74): creación, preferencias (RF-109),
 * lectura individual/masiva y disparo automático al acreditar recargas (RF-106).
 * Requiere `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCreateNotification } from "@/application/notifications/create-notification";
import { createListPassengerNotifications } from "@/application/notifications/list-passenger-notifications";
import {
  createMarkAllNotificationsAsRead,
  createMarkNotificationAsRead,
} from "@/application/notifications/mark-notification-read";
import { createNotifyServiceAnnouncement } from "@/application/notifications/notify-service-announcement";
import { createUpdateNotificationPreferences } from "@/application/notifications/update-notification-preferences";
import { Money } from "@/domain/shared/money";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNotificationRepository } from "@/infrastructure/notifications/prisma-notification-repository";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("notificaciones del pasajero en PostgreSQL", () => {
  const db = prisma!;
  const tag = `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-5)}`;
  let enabledUserId: string;
  let disabledUserId: string;

  beforeAll(async () => {
    const enabledUser = await db.user.create({
      data: {
        email: `notif-on-${tag}@pasolanchas.test`,
        fullName: "Pasajero Notificaciones Activas",
        passwordHash: "test-hash",
        role: "PASSENGER",
        status: "ACTIVE",
        notificationsEnabled: true,
        wallet: { create: { balance: "0.00" } },
      },
    });
    enabledUserId = enabledUser.id;

    const disabledUser = await db.user.create({
      data: {
        email: `notif-off-${tag}@pasolanchas.test`,
        fullName: "Pasajero Notificaciones Desactivadas",
        passwordHash: "test-hash",
        role: "PASSENGER",
        status: "ACTIVE",
        notificationsEnabled: false,
        wallet: { create: { balance: "0.00" } },
      },
    });
    disabledUserId = disabledUser.id;
  });

  afterAll(async () => {
    await db.notification.deleteMany({
      where: { userId: { in: [enabledUserId, disabledUserId] } },
    });
    await db.$disconnect();
  });

  it("crea notificaciones, difunde avisos solo a activos y marca como leídas (RF-107, RF-109)", async () => {
    const repo = new PrismaNotificationRepository(db);
    const createNotification = createCreateNotification({ repo });
    const notifyAnnouncement = createNotifyServiceAnnouncement({ repo });
    const listNotifications = createListPassengerNotifications({ repo });
    const markAsRead = createMarkNotificationAsRead({ repo });
    const markAllAsRead = createMarkAllNotificationsAsRead({ repo });
    const updatePreferences = createUpdateNotificationPreferences({ repo });

    const created = await createNotification({
      userId: enabledUserId,
      type: "TRIP_CANCELLED_REFUND",
      title: `Salida cancelada ${tag}`,
      body: "Tu salida fue cancelada y se reembolsó tu saldo.",
    });
    expect(created).not.toBeNull();

    const skipped = await createNotification({
      userId: disabledUserId,
      type: "TRIP_CANCELLED_REFUND",
      title: `Salida cancelada ${tag}`,
      body: "No debe guardarse.",
    });
    expect(skipped).toBeNull();

    await notifyAnnouncement({
      title: `Aviso operativo ${tag}`,
      message: "Cruces operando con normalidad.",
    });

    const beforeRead = await listNotifications(enabledUserId);
    expect(beforeRead.unreadCount).toBeGreaterThanOrEqual(2);
    expect(beforeRead.read).toHaveLength(0);

    const disabledList = await listNotifications(disabledUserId);
    expect(disabledList.unreadCount).toBe(0);

    await markAsRead({ notificationId: created!.id }, enabledUserId);
    const afterOneRead = await listNotifications(enabledUserId);
    expect(afterOneRead.read.some((n) => n.id === created!.id)).toBe(true);

    await markAllAsRead(enabledUserId);
    const afterAllRead = await listNotifications(enabledUserId);
    expect(afterAllRead.unreadCount).toBe(0);

    const toggled = await updatePreferences({ enabled: false }, enabledUserId);
    expect(toggled).toBe(false);
    expect(await repo.isNotificationsEnabled(enabledUserId)).toBe(false);

    // Reactivar para las siguientes pruebas
    await updatePreferences({ enabled: true }, enabledUserId);
  });

  it("genera notificación automática al acreditar una recarga en el monedero (RF-106)", async () => {
    const walletRepo = new PrismaWalletRepository(db);
    const notifRepo = new PrismaNotificationRepository(db);
    const listNotifications = createListPassengerNotifications({ repo: notifRepo });

    await walletRepo.withTransaction((tx) =>
      walletRepo.credit(
        tx,
        {
          userId: enabledUserId,
          amount: Money.fromPesos(100),
          type: "TOPUP_ONLINE",
          performedById: enabledUserId,
          at: new Date(),
          reason: "Recarga de prueba",
        },
        {
          userId: enabledUserId,
          action: "WALLET_TOPUP_CASH",
          details: { passengerId: enabledUserId, amountCents: 10000 },
        },
      ),
    );

    const state = await listNotifications(enabledUserId);
    const rechargeNotif = state.unread.find((n) => n.type === "RECHARGE_CREDITED");
    expect(rechargeNotif).toBeDefined();
    expect(rechargeNotif?.body).toContain("$100.00 MXN");
  });
});
