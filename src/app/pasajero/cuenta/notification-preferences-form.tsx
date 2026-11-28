"use client";

import { useState, useTransition } from "react";

import {
  type NotificationPreferencesActionState,
  updateNotificationPreferencesAction,
} from "./actions";

interface NotificationPreferencesFormProps {
  initialEnabled: boolean;
}

export function NotificationPreferencesForm({ initialEnabled }: NotificationPreferencesFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [feedback, setFeedback] = useState<Omit<NotificationPreferencesActionState, "enabled">>({
    status: "idle",
  });
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const nextEnabled = !enabled;
    startTransition(async () => {
      const result = await updateNotificationPreferencesAction(nextEnabled);
      setEnabled(result.enabled);
      setFeedback({ status: result.status, message: result.message });
    });
  }

  return (
    <section
      aria-labelledby="notification-preferences-heading"
      className="border-line rounded-2xl border bg-white p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="notification-preferences-heading"
            className="font-heading text-ink text-base font-bold"
          >
            Notificaciones dentro de la app
          </h2>
          <p className="text-ink-muted mt-1 text-xs leading-relaxed">
            Recibe avisos cuando se acredite una recarga, se publique un aviso de servicio o se
            cancele una salida con reembolso (RF-109).
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activar o desactivar notificaciones"
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled ? "bg-brand" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="text-ink mt-2 text-xs font-bold">
        Estado actual:{" "}
        <span className={enabled ? "text-success-ink" : "text-ink-muted"}>
          {isPending ? "Guardando..." : enabled ? "Activadas" : "Desactivadas"}
        </span>
      </p>

      {feedback.status === "success" && feedback.message ? (
        <p
          role="status"
          className="bg-success-bg text-success-ink mt-3 rounded-xl px-3.5 py-2.5 text-xs font-bold"
        >
          {feedback.message}
        </p>
      ) : null}

      {feedback.status === "error" && feedback.message ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700"
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
