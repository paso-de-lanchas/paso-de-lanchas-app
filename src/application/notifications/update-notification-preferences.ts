import { updateNotificationPreferencesSchema } from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";

import type { NotificationRepository } from "./ports";

/** Activa o desactiva las notificaciones para el pasajero (RF-109). */
export function createUpdateNotificationPreferences(deps: { repo: NotificationRepository }) {
  return async function updateNotificationPreferences(
    rawInput: unknown,
    userId: string,
  ): Promise<boolean> {
    const parsed = updateNotificationPreferencesSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_NOTIFICATION_PREFERENCE",
        parsed.error.issues[0]?.message ?? "El valor de preferencia no es válido.",
      );
    }

    const updated = await deps.repo.updatePreferences(userId, parsed.data.enabled, {
      userId,
      action: "NOTIFICATION_PREFERENCES_UPDATED",
      details: { notificationsEnabled: parsed.data.enabled },
    });
    if (!updated) {
      throw new DomainError("USER_NOT_FOUND", "No se encontró la cuenta del pasajero.");
    }

    return parsed.data.enabled;
  };
}
