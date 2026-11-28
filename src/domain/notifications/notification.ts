import { z } from "zod";

export const NOTIFICATION_TYPES = {
  RECHARGE_CREDITED: "RECHARGE_CREDITED",
  SERVICE_ANNOUNCEMENT: "SERVICE_ANNOUNCEMENT",
  SERVICE_SUSPENDED: "SERVICE_SUSPENDED",
  TRIP_CANCELLED_REFUND: "TRIP_CANCELLED_REFUND",
} as const;

export type KnownNotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationDraft {
  type: string;
  title: string;
  body: string;
}

export interface PartitionedNotifications {
  unreadCount: number;
  unread: NotificationItem[];
  read: NotificationItem[];
}

export const createNotificationInputSchema = z.object({
  userId: z.string().uuid("El identificador del pasajero no es válido."),
  type: z
    .string()
    .trim()
    .min(1, "El tipo de notificación es obligatorio.")
    .max(40, "El tipo de notificación no puede superar 40 caracteres."),
  title: z
    .string()
    .trim()
    .min(1, "El título de la notificación es obligatorio.")
    .max(120, "El título no puede superar 120 caracteres."),
  body: z
    .string()
    .trim()
    .min(1, "El contenido de la notificación es obligatorio.")
    .max(1000, "El contenido no puede superar 1000 caracteres."),
});

export const serviceAnnouncementNotificationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título del aviso es obligatorio.")
    .max(100, "El título del aviso no puede superar 100 caracteres."),
  message: z
    .string()
    .trim()
    .min(1, "El mensaje del aviso es obligatorio.")
    .max(800, "El mensaje del aviso no puede superar 800 caracteres."),
  suspended: z.boolean().optional().default(false),
  dockName: z.string().trim().min(1).max(60).nullable().optional(),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid("El identificador de la notificación no es válido."),
});

export const updateNotificationPreferencesSchema = z.object({
  enabled: z.boolean({
    error: "Debes indicar si deseas activar o desactivar las notificaciones.",
  }),
});

function formatPesosFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)} MXN`;
}

/** Etiqueta legible para mostrar en la tarjeta del pasajero (incluye tipos creados por #46). */
export function getNotificationCategoryLabel(type: string): string {
  switch (type) {
    case NOTIFICATION_TYPES.RECHARGE_CREDITED:
      return "Saldo y recargas";
    case NOTIFICATION_TYPES.SERVICE_ANNOUNCEMENT:
      return "Aviso del servicio";
    case NOTIFICATION_TYPES.SERVICE_SUSPENDED:
      return "Suspensión de servicio";
    case NOTIFICATION_TYPES.TRIP_CANCELLED_REFUND:
    case "DEPARTURE_CANCELLED":
    case "REFUND":
      return "Viaje y reembolso";
    default:
      return "Aviso";
  }
}

/** Construye la notificación de recarga acreditada (RF-106). */
export function buildRechargeCreditedNotification(params: {
  amountCents: number;
  method: "CASH" | "ONLINE";
  balanceAfterCents: number;
}): NotificationDraft {
  const channelLabel = params.method === "CASH" ? "en taquilla" : "en línea";
  return {
    type: NOTIFICATION_TYPES.RECHARGE_CREDITED,
    title: "Recarga acreditada",
    body: `Se acreditaron ${formatPesosFromCents(params.amountCents)} (${channelLabel}) a tu monedero. Nuevo saldo: ${formatPesosFromCents(params.balanceAfterCents)}.`,
  };
}

/** Construye la notificación de aviso operativo o suspensión de servicio (RF-107). */
export function buildServiceAnnouncementNotification(params: {
  title: string;
  message: string;
  suspended?: boolean;
  dockName?: string | null;
}): NotificationDraft {
  const dockPrefix = params.dockName ? `[${params.dockName}] ` : "";
  if (params.suspended) {
    return {
      type: NOTIFICATION_TYPES.SERVICE_SUSPENDED,
      title: `${dockPrefix}Servicio suspendido: ${params.title}`.slice(0, 120),
      body: params.message,
    };
  }
  return {
    type: NOTIFICATION_TYPES.SERVICE_ANNOUNCEMENT,
    title: `${dockPrefix}${params.title}`.slice(0, 120),
    body: params.message,
  };
}

/** Construye la notificación de salida cancelada con reembolso (RF-108). */
export function buildTripCancelledRefundNotification(params: {
  originDockName: string;
  destinationDockName: string;
  refundAmountCents: number;
  reason?: string | null;
}): NotificationDraft {
  const reasonText = params.reason ? ` Motivo: ${params.reason}.` : "";
  return {
    type: NOTIFICATION_TYPES.TRIP_CANCELLED_REFUND,
    title: "Salida cancelada con reembolso",
    body: `Tu cruce ${params.originDockName} → ${params.destinationDockName} fue cancelado. Se reembolsaron ${formatPesosFromCents(params.refundAmountCents)} a tu monedero.${reasonText}`,
  };
}

/** Separa notificaciones en no leídas y leídas ordenadas de la más reciente a la más antigua. */
export function partitionNotifications(
  items: readonly NotificationItem[],
): PartitionedNotifications {
  const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unread = sorted.filter((item) => item.readAt === null);
  const read = sorted.filter((item) => item.readAt !== null);
  return {
    unreadCount: unread.length,
    unread,
    read,
  };
}

export interface SerializedNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface SerializedPartitionedNotifications {
  unreadCount: number;
  unread: SerializedNotificationItem[];
  read: SerializedNotificationItem[];
}

export function serializeNotifications(
  data: PartitionedNotifications,
): SerializedPartitionedNotifications {
  const serializeItem = (item: NotificationItem): SerializedNotificationItem => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    readAt: item.readAt ? item.readAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  });

  return {
    unreadCount: data.unreadCount,
    unread: data.unread.map(serializeItem),
    read: data.read.map(serializeItem),
  };
}
