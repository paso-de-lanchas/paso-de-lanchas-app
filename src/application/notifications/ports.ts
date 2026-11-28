import type { ChangeAudit } from "@/application/shared/ports";
import type { NotificationDraft, NotificationItem } from "@/domain/notifications/notification";

export interface CreateNotificationRecordInput extends NotificationDraft {
  userId: string;
  createdAt: Date;
}

export interface BroadcastNotificationInput extends NotificationDraft {
  createdAt: Date;
}

export interface NotificationRepository {
  isNotificationsEnabled(userId: string): Promise<boolean>;
  create(input: CreateNotificationRecordInput): Promise<NotificationItem>;
  createForEnabledPassengers(input: BroadcastNotificationInput): Promise<number>;
  listByUserId(userId: string, limit?: number): Promise<NotificationItem[]>;
  markAsRead(notificationId: string, userId: string, readAt: Date): Promise<boolean>;
  markAllAsRead(userId: string, readAt: Date): Promise<number>;
  updatePreferences(userId: string, enabled: boolean, audit: ChangeAudit): Promise<boolean>;
}
