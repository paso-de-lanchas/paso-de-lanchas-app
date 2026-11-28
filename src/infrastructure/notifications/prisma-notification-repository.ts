import type {
  BroadcastNotificationInput,
  CreateNotificationRecordInput,
  NotificationRepository,
} from "@/application/notifications/ports";
import type { ChangeAudit } from "@/application/shared/ports";
import type { NotificationDraft, NotificationItem } from "@/domain/notifications/notification";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  readAt: true,
  createdAt: true,
} as const;

/** Crea una notificación dentro de una transacción Prisma ya abierta. */
export async function createNotificationInTx(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    draft: NotificationDraft;
    createdAt: Date;
  },
): Promise<NotificationItem> {
  return tx.notification.create({
    data: {
      userId: params.userId,
      type: params.draft.type,
      title: params.draft.title,
      body: params.draft.body,
      createdAt: params.createdAt,
    },
    select: notificationSelect,
  });
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async isNotificationsEnabled(userId: string): Promise<boolean> {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { notificationsEnabled: true },
    });
    return user?.notificationsEnabled ?? false;
  }

  async create(input: CreateNotificationRecordInput): Promise<NotificationItem> {
    return this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        createdAt: input.createdAt,
      },
      select: notificationSelect,
    });
  }

  async createForEnabledPassengers(input: BroadcastNotificationInput): Promise<number> {
    const passengers = await this.db.user.findMany({
      where: {
        role: "PASSENGER",
        status: "ACTIVE",
        deletedAt: null,
        notificationsEnabled: true,
      },
      select: { id: true },
    });
    if (passengers.length === 0) return 0;

    const result = await this.db.notification.createMany({
      data: passengers.map((passenger) => ({
        userId: passenger.id,
        type: input.type,
        title: input.title,
        body: input.body,
        createdAt: input.createdAt,
      })),
    });
    return result.count;
  }

  async listByUserId(userId: string, limit = 50): Promise<NotificationItem[]> {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: notificationSelect,
    });
  }

  async markAsRead(notificationId: string, userId: string, readAt: Date): Promise<boolean> {
    const result = await this.db.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
      },
      data: { readAt },
    });
    return result.count === 1;
  }

  async markAllAsRead(userId: string, readAt: Date): Promise<number> {
    const result = await this.db.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt },
    });
    return result.count;
  }

  async updatePreferences(userId: string, enabled: boolean, audit: ChangeAudit): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, deletedAt: null },
        data: { notificationsEnabled: enabled },
      });
      if (updated.count !== 1) {
        return false;
      }
      await tx.auditLog.create({
        data: auditLogData({
          ...audit,
          entity: "users",
          entityId: userId,
        }),
      });
      return true;
    });
  }
}
