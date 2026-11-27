"use client";

import { useActionState } from "react";

import type { CancellableBoardingView } from "@/application/boarding/ticket-office-queries";

import { cancelBoardingAction, type CancelBoardingState } from "./actions";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const peso = (cents: number) => currency.format(cents / 100);

export function CancellableBoardings({ items }: { items: CancellableBoardingView[] }) {
  return (
    <section className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs">
      <div>
        <h2 className="font-heading text-ink text-lg font-bold">Abordajes de la salida</h2>
        <p className="text-ink-muted text-xs">Solo puedes cancelar antes de que el viaje inicie.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-ink-muted text-sm">No hay abordajes activos que se puedan cancelar.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">
                  Lugar {item.seatNumber} · {item.vesselName} → {item.destinationDockName}
                </span>
                <span>
                  {peso(item.amountCents)} · {item.paymentMethod === "CASH" ? "Efectivo" : "Saldo"}
                </span>
              </div>
              {item.ticketCode && (
                <p className="text-ink-muted mt-1 font-mono text-xs">Boleto {item.ticketCode}</p>
              )}
              <CancelBoardingForm boardingId={item.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CancelBoardingForm({ boardingId }: { boardingId: string }) {
  const [state, formAction, pending] = useActionState<CancelBoardingState, FormData>(
    cancelBoardingAction,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="boardingId" value={boardingId} />
      <label className="text-ink flex flex-1 flex-col gap-1 text-xs font-semibold">
        Motivo obligatorio
        <input
          name="reason"
          required
          maxLength={500}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-rose-400 px-4 py-2 text-sm font-bold text-rose-800 disabled:opacity-60"
      >
        {pending ? "Cancelando…" : "Cancelar abordaje"}
      </button>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${state.status === "error" ? "text-rose-800" : "text-emerald-800"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
