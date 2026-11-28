import type { Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import { markNotificationReadSchema } from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";

import type { NotificationRepository } from "./ports";

export function createMarkNotificationAsRead(deps: {
  repo: NotificationRepository;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function markNotificationAsRead(rawInput: unknown, userId: string): Promise<void> {
    const parsed = markNotificationReadSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_NOTIFICATION_ID",
        parsed.error.issues[0]?.message ?? "El identificador de la notificación no es válido.",
      );
    }

    const updated = await deps.repo.markAsRead(parsed.data.notificationId, userId, clock.now());
    if (!updated) {
      throw new DomainError(
        "NOTIFICATION_NOT_FOUND",
        "No se encontró la notificación o ya estaba marcada como leída.",
      );
    }
  };
}

export function createMarkAllNotificationsAsRead(deps: {
  repo: NotificationRepository;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function markAllNotificationsAsRead(userId: string): Promise<number> {
    return deps.repo.markAllAsRead(userId, clock.now());
  };
}
