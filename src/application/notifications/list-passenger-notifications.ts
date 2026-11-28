import {
  partitionNotifications,
  type PartitionedNotifications,
} from "@/domain/notifications/notification";

import type { NotificationRepository } from "./ports";

export function createListPassengerNotifications(deps: { repo: NotificationRepository }) {
  return async function listPassengerNotifications(
    userId: string,
    limit = 50,
  ): Promise<PartitionedNotifications> {
    const items = await deps.repo.listByUserId(userId, limit);
    return partitionNotifications(items);
  };
}
