import type { Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import { createNotificationInputSchema } from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";

import type { NotificationRepository } from "./ports";

export function createCreateNotification(deps: { repo: NotificationRepository; clock?: Clock }) {
  const clock = deps.clock ?? systemClock;

  return async function createNotification(rawInput: unknown) {
    const parsed = createNotificationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_NOTIFICATION_INPUT",
        parsed.error.issues[0]?.message ?? "Los datos de la notificación no son válidos.",
      );
    }

    const enabled = await deps.repo.isNotificationsEnabled(parsed.data.userId);
    if (!enabled) {
      return null;
    }

    return deps.repo.create({
      ...parsed.data,
      createdAt: clock.now(),
    });
  };
}
