import { createListPassengerNotifications } from "@/application/notifications/list-passenger-notifications";
import {
  createMarkAllNotificationsAsRead,
  createMarkNotificationAsRead,
} from "@/application/notifications/mark-notification-read";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaNotificationRepository } from "@/infrastructure/notifications/prisma-notification-repository";
import { requireApiRole } from "@/lib/auth/require-role";

/** Lista notificaciones no leídas y leídas del pasajero autenticado (RF-106 a RF-108). */
export async function GET() {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) return auth.response;

  const repo = new PrismaNotificationRepository();
  const data = await createListPassengerNotifications({ repo })(auth.user.id);

  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** Marca una notificación individual o todas como leídas. */
export async function PATCH(request: Request) {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo de la petición no es JSON válido." }, { status: 400 });
  }

  const repo = new PrismaNotificationRepository();
  try {
    const payload = body as { markAll?: unknown; notificationId?: unknown } | null;
    if (payload && payload.markAll === true) {
      await createMarkAllNotificationsAsRead({ repo })(auth.user.id);
    } else {
      await createMarkNotificationAsRead({ repo })(body, auth.user.id);
    }

    const updated = await createListPassengerNotifications({ repo })(auth.user.id);
    return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "NOTIFICATION_NOT_FOUND" ? 404 : 400;
      return Response.json({ error: error.message }, { status });
    }
    throw error;
  }
}
