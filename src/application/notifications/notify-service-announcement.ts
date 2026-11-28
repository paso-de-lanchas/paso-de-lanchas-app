import type { Clock } from "@/application/shared/ports";
import { systemClock } from "@/application/shared/ports";
import {
  buildServiceAnnouncementNotification,
  serviceAnnouncementNotificationSchema,
} from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";

import type { NotificationRepository } from "./ports";

/** Difunde un aviso publicado o suspensión de servicio a pasajeros con notificaciones activas (RF-107). */
export function createNotifyServiceAnnouncement(deps: {
  repo: NotificationRepository;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  return async function notifyServiceAnnouncement(rawInput: unknown): Promise<number> {
    const parsed = serviceAnnouncementNotificationSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_ANNOUNCEMENT_NOTIFICATION",
        parsed.error.issues[0]?.message ?? "Los datos del aviso no son válidos.",
      );
    }

    const draft = buildServiceAnnouncementNotification(parsed.data);
    return deps.repo.createForEnabledPassengers({
      ...draft,
      createdAt: clock.now(),
    });
  };
}
