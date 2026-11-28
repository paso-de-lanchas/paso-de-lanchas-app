"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { DockOption } from "@/application/announcements/ports";

import {
  type AnnouncementActionState,
  closeAnnouncementAction,
  publishAnnouncementAction,
} from "./actions";

export interface AdminAnnouncementItemView {
  id: string;
  scopeLabel: string;
  title: string;
  message: string;
  startsAtLabel: string;
  endsAtLabel: string | null;
  createdByName: string;
  status: "ACTIVE" | "SCHEDULED" | "ENDED";
}

interface AnnouncementManagerProps {
  docks: DockOption[];
  announcements: AdminAnnouncementItemView[];
}

const initialState: AnnouncementActionState = { status: "idle" };

function CloseAnnouncementButton({ announcementId }: { announcementId: string }) {
  const [state, formAction, isPending] = useActionState(closeAnnouncementAction, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="announcementId" value={announcementId} />
      <button
        type="submit"
        disabled={isPending}
        className="border-line text-ink hover:border-brand hover:text-brand rounded-lg border bg-white px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
      >
        {isPending ? "Finalizando..." : "Finalizar ahora"}
      </button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-[11px] font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AnnouncementManager({ docks, announcements }: AnnouncementManagerProps) {
  const [state, formAction, isPending] = useActionState(publishAnnouncementAction, initialState);

  return (
    <div className="space-y-6">
      <section className="border-line rounded-2xl border bg-white p-5 shadow-xs">
        <h2 className="font-heading text-ink text-base font-bold">Publicar nuevo aviso</h2>
        <p className="text-ink-muted mt-0.5 text-xs">
          Los avisos vigentes aparecen de inmediato en la pantalla principal de los pasajeros
          (RF-104 y RF-105).
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          {state.status === "success" && state.message ? (
            <p
              role="status"
              className="bg-success-bg text-success-ink rounded-xl px-3.5 py-2.5 text-xs font-bold"
            >
              {state.message}
            </p>
          ) : null}

          {state.status === "error" && state.message ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700"
            >
              {state.message}
            </p>
          ) : null}

          <div>
            <label htmlFor="announcement-title" className="text-ink block text-xs font-bold">
              Título del aviso <span className="text-red-600">*</span>
            </label>
            <input
              id="announcement-title"
              name="title"
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="Ej. Demoras por viento del norte"
              className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="announcement-message" className="text-ink block text-xs font-bold">
              Mensaje para los pasajeros <span className="text-red-600">*</span>
            </label>
            <textarea
              id="announcement-message"
              name="message"
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              placeholder="Describe la situación operativa, recomendaciones o cambios temporales..."
              className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="announcement-dock" className="text-ink block text-xs font-bold">
                Alcance
              </label>
              <select
                id="announcement-dock"
                name="dockId"
                defaultValue="ALL"
                className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="ALL">Todos los muelles</option>
                {docks.map((dock) => (
                  <option key={dock.id} value={dock.id}>
                    {dock.name} ({dock.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="announcement-starts" className="text-ink block text-xs font-bold">
                Inicio de vigencia (opcional)
              </label>
              <input
                id="announcement-starts"
                name="startsAt"
                type="datetime-local"
                className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
              />
              <p className="text-ink-muted mt-1 text-[11px]">Vacío = inicia al publicar.</p>
            </div>

            <div>
              <label htmlFor="announcement-ends" className="text-ink block text-xs font-bold">
                Fin de vigencia (opcional)
              </label>
              <input
                id="announcement-ends"
                name="endsAt"
                type="datetime-local"
                className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
              />
              <p className="text-ink-muted mt-1 text-[11px]">
                Vacío = vigente hasta finalizarlo manualmente.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="bg-brand hover:bg-brand-accent w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Publicando aviso..." : "Publicar aviso"}
          </button>
        </form>
      </section>

      <aside className="border-line bg-surface rounded-2xl border p-4 text-xs">
        <p className="text-ink font-bold">
          ¿Necesitas suspender el servicio de un muelle (RF-103)?
        </p>
        <p className="text-ink-muted mt-1">
          Las suspensiones que bloquean el abordaje en taquilla se configuran en{" "}
          <Link href="/admin/operacion" className="text-brand font-bold underline">
            Operación del muelle
          </Link>{" "}
          y también se muestran automáticamente como alerta en la pantalla del pasajero.
        </p>
      </aside>

      <section aria-labelledby="recent-announcements-heading" className="space-y-3">
        <h2 id="recent-announcements-heading" className="font-heading text-ink text-lg font-bold">
          Avisos registrados
        </h2>

        {announcements.length === 0 ? (
          <div className="border-line text-ink-muted rounded-2xl border bg-white p-5 text-sm shadow-xs">
            Aún no hay avisos publicados.
          </div>
        ) : (
          <ul className="space-y-3">
            {announcements.map((item) => (
              <li
                key={item.id}
                className="border-line flex flex-col justify-between gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:flex-row sm:items-start"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        item.status === "ACTIVE"
                          ? "bg-success-bg text-success-ink rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          : item.status === "SCHEDULED"
                            ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900"
                            : "bg-surface text-ink-muted rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      }
                    >
                      {item.status === "ACTIVE"
                        ? "Vigente"
                        : item.status === "SCHEDULED"
                          ? "Programado"
                          : "Finalizado"}
                    </span>
                    <span className="bg-brand/10 text-brand rounded-md px-2 py-0.5 text-[11px] font-bold">
                      {item.scopeLabel}
                    </span>
                  </div>

                  <p className="font-heading text-ink text-base font-bold">{item.title}</p>
                  <p className="text-ink text-sm">{item.message}</p>
                  <p className="text-ink-muted text-[11px]">
                    Inicio: {item.startsAtLabel}
                    {item.endsAtLabel ? ` · Fin: ${item.endsAtLabel}` : " · Sin fecha de cierre"} ·
                    Publicado por {item.createdByName}
                  </p>
                </div>

                {item.status === "ACTIVE" ? (
                  <div className="shrink-0">
                    <CloseAnnouncementButton announcementId={item.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
