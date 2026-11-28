import { describe, expect, it } from "vitest";

import type { ChangeAudit } from "@/application/shared/ports";
import type { NotificationItem } from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";

import { createCreateNotification } from "./create-notification";
import { createListPassengerNotifications } from "./list-passenger-notifications";
import {
  createMarkAllNotificationsAsRead,
  createMarkNotificationAsRead,
} from "./mark-notification-read";
import { createNotifyServiceAnnouncement } from "./notify-service-announcement";
import type {
  BroadcastNotificationInput,
  CreateNotificationRecordInput,
  NotificationRepository,
} from "./ports";
import { createUpdateNotificationPreferences } from "./update-notification-preferences";

const USER_1 = "11111111-1111-4111-8111-111111111111";
const USER_2 = "22222222-2222-4222-8222-222222222222";
const NOTIF_1 = "33333333-3333-4333-8333-333333333333";

function createFakeNotificationRepo(initialEnabled: Record<string, boolean> = { [USER_1]: true }) {
  const enabledMap = new Map<string, boolean>(Object.entries(initialEnabled));
  const items: NotificationItem[] = [];
  const audits: ChangeAudit[] = [];

  const repo: NotificationRepository = {
    async isNotificationsEnabled(userId) {
      return enabledMap.get(userId) ?? false;
    },
    async create(input: CreateNotificationRecordInput) {
      const record: NotificationItem = {
        id: items.length === 0 ? NOTIF_1 : `00000000-0000-4000-8000-00000000000${items.length + 1}`,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        readAt: null,
        createdAt: input.createdAt,
      };
      items.push(record);
      return record;
    },
    async createForEnabledPassengers(input: BroadcastNotificationInput) {
      let count = 0;
      for (const [userId, enabled] of enabledMap.entries()) {
        if (!enabled) continue;
        await repo.create({ ...input, userId });
        count += 1;
      }
      return count;
    },
    async listByUserId(userId, limit = 50) {
      return items.filter((i) => i.userId === userId).slice(0, limit);
    },
    async markAsRead(notificationId, userId, readAt) {
      const target = items.find((i) => i.id === notificationId && i.userId === userId);
      if (!target || target.readAt !== null) return false;
      target.readAt = readAt;
      return true;
    },
    async markAllAsRead(userId, readAt) {
      let count = 0;
      for (const item of items) {
        if (item.userId === userId && item.readAt === null) {
          item.readAt = readAt;
          count += 1;
        }
      }
      return count;
    },
    async updatePreferences(userId, enabled, audit) {
      if (!enabledMap.has(userId)) return false;
      enabledMap.set(userId, enabled);
      audits.push(audit);
      return true;
    },
  };

  return { repo, items, audits, enabledMap };
}

describe("casos de uso de notificaciones", () => {
  const fixedNow = new Date("2026-11-27T18:00:00Z");
  const clock = { now: () => fixedNow };

  it("crea una notificación cuando el pasajero las tiene activas y la omite si las desactivó (RF-109)", async () => {
    const { repo, items } = createFakeNotificationRepo({
      [USER_1]: true,
      [USER_2]: false,
    });
    const createNotification = createCreateNotification({ repo, clock });

    const created = await createNotification({
      userId: USER_1,
      type: "RECHARGE_CREDITED",
      title: "Recarga acreditada",
      body: "Se acreditaron $100.00 MXN.",
    });
    expect(created).not.toBeNull();
    expect(items).toHaveLength(1);

    const skipped = await createNotification({
      userId: USER_2,
      type: "RECHARGE_CREDITED",
      title: "Recarga acreditada",
      body: "Se acreditaron $100.00 MXN.",
    });
    expect(skipped).toBeNull();
    expect(items).toHaveLength(1);
  });

  it("difunde avisos publicados solo a pasajeros con notificaciones activas (RF-107)", async () => {
    const { repo, items } = createFakeNotificationRepo({
      [USER_1]: true,
      [USER_2]: false,
    });
    const notifyAnnouncement = createNotifyServiceAnnouncement({ repo, clock });

    const delivered = await notifyAnnouncement({
      title: "Mal tiempo",
      message: "Servicio suspendido temporalmente.",
      suspended: true,
      dockName: "Villa Allende",
    });

    expect(delivered).toBe(1);
    expect(items[0]?.userId).toBe(USER_1);
    expect(items[0]?.type).toBe("SERVICE_SUSPENDED");
  });

  it("lista contador de no leídas, marca individual y marca todas como leídas", async () => {
    const { repo } = createFakeNotificationRepo({ [USER_1]: true });
    const createNotification = createCreateNotification({ repo, clock });
    const listNotifications = createListPassengerNotifications({ repo });
    const markAsRead = createMarkNotificationAsRead({ repo, clock });
    const markAllAsRead = createMarkAllNotificationsAsRead({ repo, clock });

    await createNotification({
      userId: USER_1,
      type: "RECHARGE_CREDITED",
      title: "Notificación 1",
      body: "Cuerpo 1",
    });
    await createNotification({
      userId: USER_1,
      type: "SERVICE_ANNOUNCEMENT",
      title: "Notificación 2",
      body: "Cuerpo 2",
    });

    let state = await listNotifications(USER_1);
    expect(state.unreadCount).toBe(2);
    expect(state.read).toHaveLength(0);

    await markAsRead({ notificationId: NOTIF_1 }, USER_1);
    state = await listNotifications(USER_1);
    expect(state.unreadCount).toBe(1);
    expect(state.read).toHaveLength(1);

    await expect(markAsRead({ notificationId: NOTIF_1 }, USER_2)).rejects.toThrow(DomainError);

    const markedAll = await markAllAsRead(USER_1);
    expect(markedAll).toBe(1);
    state = await listNotifications(USER_1);
    expect(state.unreadCount).toBe(0);
    expect(state.read).toHaveLength(2);
  });

  it("actualiza preferencias de notificaciones y registra auditoría (RF-109)", async () => {
    const { repo, enabledMap, audits } = createFakeNotificationRepo({ [USER_1]: true });
    const updatePreferences = createUpdateNotificationPreferences({ repo });

    const result = await updatePreferences({ enabled: false }, USER_1);
    expect(result).toBe(false);
    expect(enabledMap.get(USER_1)).toBe(false);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("NOTIFICATION_PREFERENCES_UPDATED");
  });
});
