"use client";

import { useActionState, useState } from "react";

import type { TicketOfficeDepartureView } from "@/application/boarding/ticket-office-queries";

import { sellTicketsAction, type TicketSaleState } from "./actions";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const peso = (cents: number) => currency.format(cents / 100);

export function TicketSalePanel({ departure }: { departure: TicketOfficeDepartureView | null }) {
  const [state, formAction, pending] = useActionState<TicketSaleState, FormData>(
    sellTicketsAction,
    { status: "idle" },
  );
  const [count, setCount] = useState(1);
  const [selections, setSelections] = useState<string[]>([]);
  if (!departure) {
    return (
      <section className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs">
        <div>
          <h2 className="font-heading text-ink text-lg font-bold">Vender boletos en efectivo</h2>
          <p className="text-ink-muted mt-2 text-sm">
            No hay una embarcación abordando en este muelle.
          </p>
        </div>
        <TicketSaleResult state={state} />
      </section>
    );
  }

  const options = departure.fares.map((fare) => ({
    value: fare.id,
    label:
      fare.category === "VEHICLE"
        ? `${fare.vehicleTypeName ?? "Vehículo"} · ${peso(fare.amountCents)}`
        : `${fare.category === "PEDESTRIAN" ? "Peatón" : fare.category === "GENERAL" ? "General" : fare.category === "STUDENT" ? "Estudiante" : "INAPAM"} · ${peso(fare.amountCents)}`,
    amountCents: fare.amountCents,
  }));
  const availableSeats = Math.max(0, departure.passengerCapacity - departure.occupiedSeats);
  const maxTickets = Math.min(departure.maxTicketsPerSale, availableSeats);
  const initialSelection = options[0]?.value ?? "";
  const visibleCount = Math.min(count, maxTickets);
  const selected = Array.from(
    { length: visibleCount },
    (_, index) => selections[index] ?? initialSelection,
  );
  const totalCents = selected.reduce(
    (total, value) => total + (options.find((option) => option.value === value)?.amountCents ?? 0),
    0,
  );

  return (
    <section className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs">
      <div>
        <h2 className="font-heading text-ink text-lg font-bold">Vender boletos en efectivo</h2>
        <p className="text-ink-muted text-xs">
          {departure.vesselName} → {departure.destinationDockName} · quedan {availableSeats} lugares
        </p>
      </div>
      {options.length === 0 ? (
        <p role="alert" className="text-sm text-rose-800">
          No hay tarifas vigentes configuradas para esta embarcación.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="text-ink flex max-w-xs flex-col gap-1 text-xs font-semibold">
            Cantidad (máximo {departure.maxTicketsPerSale})
            <select
              value={count}
              onChange={(event) => {
                const nextCount = Number(event.currentTarget.value);
                setCount(nextCount);
                setSelections((current) =>
                  Array.from(
                    { length: nextCount },
                    (_, index) => current[index] ?? initialSelection,
                  ),
                );
              }}
              disabled={maxTickets === 0 || pending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: maxTickets }, (_, index) => index + 1).map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}
                </option>
              ))}
            </select>
          </label>

          {selected.map((value, index) => (
            <label
              key={index}
              className="text-ink flex flex-col gap-1 text-xs font-semibold sm:max-w-md"
            >
              Boleto {index + 1}
              <select
                name="ticket"
                value={value}
                onChange={(event) =>
                  setSelections((current) => {
                    const next = [...current];
                    next[index] = event.currentTarget.value;
                    return next;
                  })
                }
                disabled={pending}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <p className="text-ink text-sm font-bold">Total: {peso(totalCents)}</p>
          <button
            type="submit"
            disabled={maxTickets === 0 || pending}
            className="bg-brand self-start rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Registrando venta…" : "Confirmar venta en efectivo"}
          </button>
        </form>
      )}

      <TicketSaleResult state={state} />
    </section>
  );
}

function TicketSaleResult({ state }: { state: TicketSaleState }) {
  if (state.status === "idle") return null;
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
        {state.message}
      </p>
    );
  }

  return (
    <article className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
      <p className="font-bold">Venta registrada · {peso(state.confirmation.totalCents)}</p>
      <p className="mt-1 text-sm">
        {state.confirmation.vesselName} → {state.confirmation.destinationDockName}
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {state.confirmation.tickets.map((ticket) => (
          <li key={ticket.boardingId} className="flex flex-wrap justify-between gap-2">
            <span>
              Lugar {ticket.seatNumber} · {categoryLabel(ticket.fareCategory)}
            </span>
            <span className="font-mono font-bold" aria-label="Código del boleto">
              {ticket.ticketCode}
            </span>
            <span>{peso(ticket.amountCents)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-3 rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold"
      >
        Imprimir boletos
      </button>
      {state.confirmation.departureClosed && (
        <p className="mt-3 text-sm font-semibold">La embarcación se llenó y cerró abordaje.</p>
      )}
    </article>
  );
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    GENERAL: "General",
    STUDENT: "Estudiante",
    INAPAM: "INAPAM",
    PEDESTRIAN: "Peatón",
    VEHICLE: "Vehículo",
  };
  return labels[category] ?? category;
}
