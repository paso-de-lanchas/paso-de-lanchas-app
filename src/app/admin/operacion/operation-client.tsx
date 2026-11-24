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
  reportIncidentAction,
  setExtraServiceAction,
} from "./actions";

interface BoardingTimeoutInfo {
  overdue: boolean;
  elapsedMinutes: number;
  maxMinutes: number;
}

interface OperationClientProps {
  docks: DockSummary[];
  selectedDockId: string;
  lockDock: boolean;
  vessels: EligibleVessel[];
  boarding: DepartureRecord | null;
  queued: DepartureRecord[];
  waitlist: WaitlistEntryRecord[];
  activeDepartures?: DepartureRecord[];
  serviceOpen?: boolean;
  serviceReason?: string | null;
  extraServiceActive?: boolean;
  boardingTimeout?: BoardingTimeoutInfo;
}

export function OperationClient({
  docks,
  selectedDockId,
  lockDock,
  vessels,
  boarding,
  queued,
  waitlist,
  activeDepartures = [],
  serviceOpen = true,
  serviceReason = null,
  extraServiceActive = false,
  boardingTimeout = { overdue: false, elapsedMinutes: 0, maxMinutes: 20 },
}: OperationClientProps) {
  const [vesselId, setVesselId] = useState(vessels[0]?.id ?? "");
  const defaultDest = docks.find((d) => d.id !== selectedDockId)?.id ?? docks[0]?.id ?? "";
  const [destinationDockId, setDestinationDockId] = useState(defaultDest);
  const [waitlistLabel, setWaitlistLabel] = useState("");
  const [extraReason, setExtraReason] = useState("");
  const [incidentVesselId, setIncidentVesselId] = useState(
    boarding?.vesselId ?? vessels[0]?.id ?? "",
  );
  const [incidentDepartureId, setIncidentDepartureId] = useState(
    boarding?.id ?? activeDepartures[0]?.id ?? "",
  );
  const [incidentType, setIncidentType] = useState("FALLA_MECANICA");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentAction, setIncidentAction] = useState<"REASSIGN" | "REFUND">("REASSIGN");
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

  function handleToggleExtraService(enabled: boolean) {
    if (!extraReason.trim()) {
      setFeedback({
        ok: false,
        text: "Debes indicar el motivo del servicio extraordinario.",
      });
      return;
    }
    startTransition(async () => {
      const res = await setExtraServiceAction({
        dockId: selectedDockId,
        enabled,
        reason: extraReason.trim(),
      });
      if (res.ok) setExtraReason("");
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  function handleReportIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!incidentVesselId || !incidentType.trim() || !incidentDescription.trim()) {
      setFeedback({
        ok: false,
        text: "Completa embarcación, tipo y descripción del incidente.",
      });
      return;
    }
    startTransition(async () => {
      const res = await reportIncidentAction({
        vesselId: incidentVesselId,
        departureId: incidentDepartureId || null,
        type: incidentType.trim(),
        description: incidentDescription.trim(),
        action: incidentAction,
      });
      if (res.ok) setIncidentDescription("");
      setFeedback({ ok: res.ok, text: res.message });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-slate-500">Muelle de operación</p>
          <p className="text-base font-semibold text-slate-900">
            {dockMap.get(selectedDockId) ?? selectedDockId}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Estado de horario:{" "}
            <span
              className={
                serviceOpen ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"
              }
            >
              {serviceOpen ? "Servicio abierto" : "Fuera de horario / suspendido"}
            </span>
            {serviceReason ? ` — ${serviceReason}` : ""}
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
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {d.code}
              </a>
            ))}
          </div>
        )}
      </div>

      {boarding && boardingTimeout.overdue && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <div>
            <p className="font-semibold">
              Aviso de tiempo máximo de abordaje superado ({boardingTimeout.elapsedMinutes} min /{" "}
              {boardingTimeout.maxMinutes} min máx.)
            </p>
            <p className="text-xs text-amber-800">
              La salida actual lleva más tiempo abordando del configurado; puedes cerrar el abordaje
              ahora.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleCloseBoarding(boarding.id)}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            Cerrar abordaje ahora
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-lg font-semibold text-slate-900">Salida abordando actualmente</h2>
        {boarding ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="font-medium text-slate-900">
                {vesselMap.get(boarding.vesselId)?.code ?? boarding.vesselId} —{" "}
                {vesselMap.get(boarding.vesselId)?.name ?? "Embarcación"}
              </p>
              <p className="text-sm text-slate-600">
                Destino: {dockMap.get(boarding.destinationDockId) ?? boarding.destinationDockId}
              </p>
              <p className="text-sm font-medium text-slate-800">
                Ocupación: {boarding.occupiedSeats} / {boarding.passengerCapacity} lugares
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleCloseBoarding(boarding.id)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Cerrar abordaje
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No hay ninguna embarcación abordando en este muelle.
          </p>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">Formar embarcación en fila</h2>
          <form onSubmit={handleEnqueue} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Embarcación (activa con chofer asignado)
              </label>
              <select
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              <label className="block text-sm font-medium text-slate-700">Muelle de destino</label>
              <select
                value={destinationDockId}
                onChange={(e) => setDestinationDockId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Agregar a la fila
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Fila de espera de embarcaciones ({queued.length})
            </h3>
            {queued.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No hay embarcaciones en fila.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {queued.map((item, idx) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="font-semibold text-slate-900">#{idx + 1}</span>{" "}
                      <span className="text-slate-800">
                        {vesselMap.get(item.vesselId)?.code ?? item.vesselId}
                      </span>{" "}
                      <span className="text-slate-500">
                        → {dockMap.get(item.destinationDockId) ?? item.destinationDockId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPending || idx === 0}
                        onClick={() => handleMove(idx, -1)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        disabled={isPending || idx === queued.length - 1}
                        onClick={() => handleMove(idx, 1)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
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

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">Lista de espera (sin cobro)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Registra pasajeros por referencia de nombre sin realizar cobros.
          </p>
          <form onSubmit={handleAddWaitlist} className="mt-4 flex gap-2">
            <input
              type="text"
              value={waitlistLabel}
              onChange={(e) => setWaitlistLabel(e.target.value)}
              placeholder="Nombre del pasajero"
              maxLength={80}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending || !waitlistLabel.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Registrar
            </button>
          </form>

          <ul className="mt-5 divide-y divide-slate-100">
            {waitlist.length === 0 ? (
              <li className="py-3 text-sm text-slate-500">No hay pasajeros en lista de espera.</li>
            ) : (
              waitlist.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-slate-800">
                    {entry.label ?? entry.passengerId ?? "Pasajero"}
                    {entry.priority > 0 ? ` (Prioridad ${entry.priority})` : ""}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {entry.status}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">
            Servicio extraordinario del muelle
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Estado actual: {extraServiceActive ? "Habilitado" : "Deshabilitado"}. Requiere motivo
            obligatorio.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={extraReason}
              onChange={(e) => setExtraReason(e.target.value)}
              placeholder="Motivo del servicio extraordinario"
              maxLength={300}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending || !extraReason.trim()}
                onClick={() => handleToggleExtraService(true)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Habilitar servicio extraordinario
              </button>
              <button
                type="button"
                disabled={isPending || !extraReason.trim()}
                onClick={() => handleToggleExtraService(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Quitar servicio extraordinario
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">
            Registrar incidente de embarcación
          </h2>
          <form onSubmit={handleReportIncident} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Embarcación</label>
              <select
                value={incidentVesselId}
                onChange={(e) => setIncidentVesselId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Salida afectada (opcional si es solo aviso)
              </label>
              <select
                value={incidentDepartureId}
                onChange={(e) => setIncidentDepartureId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sin salida afectada</option>
                {activeDepartures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {vesselMap.get(d.vesselId)?.code ?? d.vesselId} ({d.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Tipo</label>
                <input
                  type="text"
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  maxLength={40}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Resolución para abordados
                </label>
                <select
                  value={incidentAction}
                  onChange={(e) => setIncidentAction(e.target.value as "REASSIGN" | "REFUND")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="REASSIGN">Reasignar a lista de espera (prioridad)</option>
                  <option value="REFUND">Reembolsar / devolver en caja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Descripción</label>
              <input
                type="text"
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Detalle del incidente"
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
            >
              Registrar incidente
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
