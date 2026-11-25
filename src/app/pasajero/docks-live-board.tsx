"use client";

import { useCallback, useEffect, useState } from "react";

import type { DocksStatusResult } from "@/application/passenger-info/get-docks-status";

const POLL_INTERVAL_MS = 10_000;

interface DocksLiveBoardProps {
  initialStatus: DocksStatusResult;
}

function formatKind(kind: "BOAT" | "FERRY"): string {
  return kind === "FERRY" ? "Transbordador" : "Lancha";
}

function formatHour(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DocksLiveBoard({ initialStatus }: DocksLiveBoardProps) {
  const [status, setStatus] = useState<DocksStatusResult>(initialStatus);
  const [syncError, setSyncError] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/pasajero/muelles", {
        cache: "no-store",
      });
      if (!response.ok) {
        setSyncError(true);
        return;
      }
      const nextStatus = (await response.json()) as DocksStatusResult;
      setStatus(nextStatus);
      setSyncError(false);
    } catch {
      setSyncError(true);
    }
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshStatus();
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        void refreshStatus();
        startPolling();
      }
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshStatus]);

  return (
    <section aria-labelledby="docks-status-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="docks-status-heading" className="font-heading text-ink text-lg font-bold">
            Estado de muelles en vivo
          </h2>
          <p className="text-ink-muted text-xs">
            Actualización automática cada 10 s · Cruce estimado: {status.crossingMinutes} min
          </p>
        </div>

        <span
          suppressHydrationWarning
          className="border-line text-ink-muted rounded-full border bg-white px-3 py-1 text-xs font-semibold"
        >
          Actualizado: {formatHour(status.updatedAtIso)}
        </span>
      </div>

      {syncError ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          Sin conexión reciente; mostrando la última lectura disponible.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {status.docks.map((dock) => (
          <article
            key={dock.dockId}
            className="border-line flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 shadow-xs"
          >
            <header className="border-line flex items-center justify-between border-b pb-3">
              <div>
                <span className="bg-brand/10 text-brand rounded-md px-2 py-0.5 font-mono text-xs font-bold">
                  {dock.dockCode}
                </span>
                <h3 className="font-heading text-ink mt-1 text-lg font-bold">{dock.dockName}</h3>
              </div>
            </header>

            <div className="space-y-2">
              <p className="text-ink-muted text-xs font-bold tracking-wide uppercase">
                Abordando en este muelle
              </p>

              {dock.boarding.length > 0 ? (
                <div className="space-y-2.5">
                  {dock.boarding.map((vessel) => (
                    <div
                      key={vessel.departureId}
                      className="border-brand/20 bg-brand/5 space-y-2 rounded-xl border p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-brand text-xs font-bold">
                            {formatKind(vessel.vesselKind)}
                          </p>
                          <p className="text-ink truncate text-base font-bold">
                            {vessel.vesselName}
                          </p>
                          {vessel.vesselColor ? (
                            <p className="text-ink-muted text-xs">Color: {vessel.vesselColor}</p>
                          ) : null}
                        </div>

                        {vessel.vesselPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={vessel.vesselPhotoUrl}
                            alt={vessel.vesselName}
                            className="h-12 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : null}
                      </div>

                      <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div>
                          <dt className="text-ink-muted">Ocupación</dt>
                          <dd className="text-ink font-bold">
                            {vessel.occupiedSeats} / {vessel.passengerCapacity} lugares
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Salida estimada</dt>
                          <dd className="text-brand font-bold">{vessel.estimatedDepartureLabel}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-ink-muted">Chofer</dt>
                          <dd className="text-ink font-medium">
                            {vessel.driverName ?? "Por asignar"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-line text-ink-muted rounded-xl border border-dashed p-3.5 text-xs">
                  Ninguna embarcación abordando en este momento.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-ink-muted text-xs font-bold tracking-wide uppercase">
                En camino hacia {dock.dockName}
              </p>

              {dock.inbound ? (
                <div className="border-line bg-surface space-y-1.5 rounded-xl border p-3.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-ink font-bold">
                      {dock.inbound.vesselName} ({formatKind(dock.inbound.vesselKind)})
                    </p>
                    <span className="text-brand font-bold">
                      Llega en: {dock.inbound.estimatedArrivalLabel}
                    </span>
                  </div>
                  <p className="text-ink-muted">
                    Desde {dock.inbound.originDockName}
                    {dock.inbound.vesselColor ? ` · Color ${dock.inbound.vesselColor}` : ""}
                  </p>
                </div>
              ) : (
                <p className="border-line text-ink-muted rounded-xl border border-dashed p-3.5 text-xs">
                  Sin embarcaciones en tránsito hacia este muelle.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
