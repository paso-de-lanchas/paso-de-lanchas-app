"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DepartureBoardingItem } from "@/application/departures/ports";
import type { DepartureStatus } from "@/domain/departures/departure-state";
import { cancelDepartureAction } from "./actions";

interface DepartureDetailProps {
  departure: {
    id: string;
    originDockName: string;
    destinationDockName: string;
    status: DepartureStatus;
    passengerCapacity: number;
    occupiedSeats: number;
    cancelReason: string | null;
  };
  boardings: DepartureBoardingItem[];
}

export function DepartureDetailClient({ departure, boardings }: DepartureDetailProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCancel =
    departure.status === "QUEUED" ||
    departure.status === "BOARDING" ||
    departure.status === "BOARDING_CLOSED";

  const handleConfirmCancel = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setFeedback({
        ok: false,
        message: "El motivo de cancelación es obligatorio.",
      });
      return;
    }

    startTransition(async () => {
      const res = await cancelDepartureAction({
        departureId: departure.id,
        cancelReason: trimmed,
      });
      setFeedback(res);
      if (res.ok) {
        setConfirmOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Detalle de salida
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              {departure.originDockName} → {departure.destinationDockName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Estado: <span className="font-medium">{departure.status}</span> · Ocupación:{" "}
              {departure.occupiedSeats}/{departure.passengerCapacity}
            </p>
            {departure.cancelReason && (
              <p className="mt-1 text-sm text-rose-700">
                Motivo de cancelación: {departure.cancelReason}
              </p>
            )}
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmOpen((prev) => !prev)}
              disabled={isPending}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Cancelar salida
            </button>
          )}
        </div>

        {confirmOpen && canCancel && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <label htmlFor="cancel-reason" className="block text-sm font-medium text-rose-950">
              Motivo obligatorio de cancelación
            </label>
            <input
              id="cancel-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Condiciones climáticas adversas en el río"
              className="mt-2 w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isPending}
                className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isPending ? "Cancelando..." : "Confirmar cancelación y reembolsos"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <p
            role="status"
            className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
              feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Lista de abordados ({boardings.length})
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-slate-500 uppercase">
                <th className="py-2 pr-4">Lugar</th>
                <th className="py-2 pr-4">Pasajero / Origen</th>
                <th className="py-2 pr-4">Categoría</th>
                <th className="py-2 pr-4">Tarifa</th>
                <th className="py-2 pr-4">Vehículo y placas</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {boardings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No hay pasajeros ni vehículos abordados en esta salida.
                  </td>
                </tr>
              ) : (
                boardings.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">#{item.seatNumber}</td>
                    <td className="py-2.5 pr-4 text-slate-800">{item.passengerName}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{item.fareCategory}</td>
                    <td className="py-2.5 pr-4 text-slate-800">${item.amountCharged}</td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {item.vehicleLabel
                        ? `${item.vehicleLabel} (${item.vehiclePlate ?? "Sin placa"})`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-slate-700">{item.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
