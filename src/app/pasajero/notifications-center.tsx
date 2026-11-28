"use client";

import { useEffect, useState } from "react";

import {
  getNotificationCategoryLabel,
  type SerializedPartitionedNotifications,
} from "@/domain/notifications/notification";

function formatMexicoDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(isoDate));
}

interface NotificationsCenterProps {
  initial: SerializedPartitionedNotifications;
}

export function NotificationsCenter({ initial }: NotificationsCenterProps) {
  const [data, setData] = useState<SerializedPartitionedNotifications>(initial);
  const [isOpen, setIsOpen] = useState<boolean>(initial.unreadCount > 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/pasajero/notificaciones", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as SerializedPartitionedNotifications;
        if (active) {
          setData(json);
        }
      } catch {
        // Sin red se conserva el último estado cargado.
      }
    }

    const timer = window.setInterval(refresh, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function handleMarkAsRead(notificationId: string) {
    setBusyId(notificationId);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/pasajero/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const json = (await res.json()) as SerializedPartitionedNotifications & { error?: string };
      if (!res.ok) {
        setErrorMessage(json.error ?? "No se pudo marcar la notificación como leída.");
        return;
      }
      setData(json);
    } catch {
      setErrorMessage("Sin conexión. Intenta de nuevo en unos segundos.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllAsRead() {
    setBusyId("ALL");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/pasajero/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const json = (await res.json()) as SerializedPartitionedNotifications & { error?: string };
      if (!res.ok) {
        setErrorMessage(json.error ?? "No se pudieron marcar todas como leídas.");
        return;
      }
      setData(json);
    } catch {
      setErrorMessage("Sin conexión. Intenta de nuevo en unos segundos.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-labelledby="passenger-notifications-heading"
      className="border-line rounded-2xl border bg-white p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-brand/10 text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0h6Z"
              />
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="passenger-notifications-heading"
                className="font-heading text-ink text-base font-bold"
              >
                Notificaciones
              </h2>
              <span
                aria-label="Contador de notificaciones sin leer"
                className={
                  data.unreadCount > 0
                    ? "bg-brand rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    : "bg-surface text-ink-muted rounded-full px-2.5 py-0.5 text-xs font-bold"
                }
              >
                {data.unreadCount} sin leer
              </span>
            </div>
            <p className="text-ink-muted text-xs">
              Avisos de recargas, servicio en muelles y reembolsos de viaje.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="border-line text-brand hover:bg-surface rounded-xl border px-3 py-1.5 text-xs font-bold transition"
        >
          {isOpen ? "Ocultar" : "Ver notificaciones"}
        </button>
      </div>

      {isOpen ? (
        <div className="border-line mt-4 space-y-4 border-t pt-4">
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          {/* Lista de no leídas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-ink text-xs font-bold tracking-wide uppercase">
                No leídas ({data.unread.length})
              </h3>
              {data.unreadCount > 0 ? (
                <button
                  type="button"
                  disabled={busyId === "ALL"}
                  onClick={handleMarkAllAsRead}
                  className="text-brand text-xs font-bold underline disabled:opacity-60"
                >
                  {busyId === "ALL" ? "Marcando..." : "Marcar todas como leídas"}
                </button>
              ) : null}
            </div>

            {data.unread.length === 0 ? (
              <p className="bg-surface text-ink-muted rounded-xl px-3.5 py-3 text-xs">
                No tienes notificaciones sin leer.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.unread.map((item) => (
                  <li key={item.id} className="border-brand/30 bg-brand/5 rounded-xl border p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="bg-brand/15 text-brand rounded-full px-2 py-0.5 text-[11px] font-bold">
                        {getNotificationCategoryLabel(item.type)}
                      </span>
                      <time className="text-ink-muted text-[11px]" dateTime={item.createdAt}>
                        {formatMexicoDateTime(item.createdAt)}
                      </time>
                    </div>
                    <p className="font-heading text-ink mt-1.5 text-sm font-bold">{item.title}</p>
                    <p className="text-ink-muted mt-1 text-xs leading-relaxed">{item.body}</p>
                    <div className="mt-2.5 flex justify-end">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleMarkAsRead(item.id)}
                        className="border-brand text-brand hover:bg-brand rounded-lg border bg-white px-2.5 py-1 text-xs font-bold transition hover:text-white disabled:opacity-60"
                      >
                        {busyId === item.id ? "Guardando..." : "Marcar como leída"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lista de leídas */}
          <div className="space-y-2.5">
            <h3 className="text-ink-muted text-xs font-bold tracking-wide uppercase">
              Leídas ({data.read.length})
            </h3>

            {data.read.length === 0 ? (
              <p className="bg-surface text-ink-muted rounded-xl px-3.5 py-3 text-xs">
                Aún no tienes notificaciones leídas.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.read.map((item) => (
                  <li key={item.id} className="border-line bg-surface/60 rounded-xl border p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="border-line text-ink-muted rounded-full border bg-white px-2 py-0.5 text-[11px] font-bold">
                        {getNotificationCategoryLabel(item.type)}
                      </span>
                      <time className="text-ink-muted text-[11px]" dateTime={item.createdAt}>
                        {formatMexicoDateTime(item.createdAt)}
                      </time>
                    </div>
                    <p className="font-heading text-ink mt-1.5 text-sm font-bold">{item.title}</p>
                    <p className="text-ink-muted mt-1 text-xs leading-relaxed">{item.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
