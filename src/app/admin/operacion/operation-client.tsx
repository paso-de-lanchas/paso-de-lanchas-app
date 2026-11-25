"use client";

import { useState, useTransition } from "react";
import type {
  DepartureRecord,
  DockSummary,
  EligibleVessel,
  WaitlistEntryRecord,
} from "@/application/departures/ports";
import {
  addToWaitlistAction,
  closeBoardingAction,
  enqueueDepartureAction,
  reorderQueueAction,
} from "./actions";

interface OperationClientProps {
  docks: DockSummary[];
  selectedDockId: string;
  lockDock: boolean;
  vessels: EligibleVessel[];
  boarding: DepartureRecord | null;
  queued: DepartureRecord[];
  waitlist: WaitlistEntryRecord[];
}

export function OperationClient({
  docks,
  selectedDockId,
  lockDock,
  vessels,
  boarding,
  queued,
  waitlist,
}: OperationClientProps) {
  const [vesselId, setVesselId] = useState(vessels[0]?.id ?? "");
  const defaultDest = docks.find((d) => d.id !== selectedDockId)?.id ?? docks[0]?.id ?? "";
  const [destinationDockId, setDestinationDockId] = useState(defaultDest);
  const [waitlistLabel, setWaitlistLabel] = useState("");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dockMap = new Map(docks.map((d) => [d.id, `${d.code} — ${d.name}`]));
  const vesselMap = new Map(vessels.map((v) => [v.id, v]));

  function handleEnqueue(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await enqueueDepartureAction({
        vesselId,
        originDockId: selectedDockId,
        destinationDockId,
      });
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  function handleMove(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= queued.length) return;
    const next = [...queued];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    startTransition(async () => {
      const res = await reorderQueueAction({
        dockId: selectedDockId,
        orderedDepartureIds: next.map((d) => d.id),
      });
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  function handleCloseBoarding(departureId: string) {
    startTransition(async () => {
      const res = await closeBoardingAction({ departureId });
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  function handleAddWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistLabel.trim()) return;
    startTransition(async () => {
      const res = await addToWaitlistAction({
        dockId: selectedDockId,
        label: waitlistLabel.trim(),
      });
      if (res.ok) setWaitlistLabel("");
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  return (
    <div className="space-y-6 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-ink/60">Muelle de operación</p>
          <p className="text-base font-semibold text-ink">
            {dockMap.get(selectedDockId) ?? selectedDockId}
          </p>
        </div>
        {!lockDock && docks.length > 1 && (
          <div className="flex items-center gap-2">
            {docks.map((d) => (
              <a
                key={d.id}
                href={`/admin/operacion?dockId=${d.id}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  d.id === selectedDockId
                    ? "bg-brand text-white"
                    : "bg-brand/10 text-ink hover:bg-brand/20"
                }`}
              >
                {d.code}
              </a>
            ))}
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.ok
              ? "border-brand/30 bg-brand/10 text-ink"
              : "border-line bg-ink/5 text-ink"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-5 shadow-xs">
        <h2 className="text-lg font-semibold text-ink">Salida abordando actualmente</h2>
        {boarding ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-ink/5 p-4">
            <div className="space-y-1">
              <p className="font-medium text-ink">
                {vesselMap.get(boarding.vesselId)?.code ?? boarding.vesselId} —{" "}
                {vesselMap.get(boarding.vesselId)?.name ?? "Embarcación"}
              </p>
              <p className="text-sm text-ink/70">
                Destino: {dockMap.get(boarding.destinationDockId) ?? boarding.destinationDockId}
              </p>
              <p className="text-sm font-medium text-ink/85">
                Ocupación: {boarding.occupiedSeats} / {boarding.passengerCapacity} lugares
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleCloseBoarding(boarding.id)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Cerrar abordaje
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/60">
            No hay ninguna embarcación abordando en este muelle.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-ink">Formar embarcación en fila</h2>
          <form onSubmit={handleEnqueue} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink/85">
                Embarcación (activa con chofer asignado)
              </label>
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.activeDriverId}>
                    {v.code} — {v.name} ({v.passengerCapacity} pax)
                    {!v.activeDriverId ? " — Sin chofer" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/85">Muelle de destino</label>
              <select
                value={destinationDockId}
                onChange={(e) => setDestinationDockId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {docks
                  .filter((d) => d.id !== selectedDockId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending || !vesselId || !destinationDockId}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Agregar a la fila
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-ink">
              Fila de espera de embarcaciones ({queued.length})
            </h3>
            {queued.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No hay embarcaciones en fila.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {queued.map((item, idx) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="font-semibold text-ink">#{idx + 1}</span>{" "}
                      <span className="text-ink/90">
                        {vesselMap.get(item.vesselId)?.code ?? item.vesselId}
                      </span>{" "}
                      <span className="text-ink/60">
                        → {dockMap.get(item.destinationDockId) ?? item.destinationDockId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPending || idx === 0}
                        onClick={() => handleMove(idx, -1)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-40"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        disabled={isPending || idx === queued.length - 1}
                        onClick={() => handleMove(idx, 1)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-40"
                      >
                        Bajar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-ink">Lista de espera (sin cobro)</h2>
          <p className="mt-1 text-xs text-ink/60">
            Registra pasajeros por referencia de nombre sin realizar cobros.
          </p>
          <form onSubmit={handleAddWaitlist} className="mt-4 flex gap-2">
            <input
              type="text"
              value={waitlistLabel}
              onChange={(e) => setWaitlistLabel(e.target.value)}
              placeholder="Nombre del pasajero"
              maxLength={80}
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={isPending || !waitlistLabel.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Registrar
            </button>
          </form>

          <ul className="mt-5 divide-y divide-line">
            {waitlist.length === 0 ? (
              <li className="py-3 text-sm text-ink/60">No hay pasajeros en lista de espera.</li>
            ) : (
              waitlist.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-ink/90">
                    {entry.label ?? entry.passengerId ?? "Pasajero"}
                  </span>
                  <span className="rounded bg-ink/5 px-2 py-0.5 text-xs text-ink/70">
                    {entry.status}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
