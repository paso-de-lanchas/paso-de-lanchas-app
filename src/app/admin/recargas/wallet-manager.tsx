"use client";

import { useActionState, useState } from "react";

import {
  type PassengerSearchActionState,
  type WalletActionState,
  adjustBalanceAction,
  searchPassengerAction,
  topUpCashAction,
} from "./actions";

interface WalletManagerProps {
  minCents: number;
  maxCents: number;
}

function formatPesos(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

function ActionMessage({ state }: { state: WalletActionState }) {
  if (!state.message) return null;
  const success = state.status === "success";
  return (
    <p
      role={success ? "status" : "alert"}
      className={`rounded-xl border p-3 text-xs ${
        success
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-rose-300 bg-rose-50 text-rose-900"
      }`}
    >
      {state.message}
      {success && state.transactionId && (
        <>
          {" "}
          <a className="font-bold underline" href={`/movimientos/${state.transactionId}`}>
            Ver comprobante
          </a>
        </>
      )}
    </p>
  );
}

function PassengerActions({
  passenger,
  minCents,
  maxCents,
}: {
  passenger: NonNullable<PassengerSearchActionState["passenger"]>;
  minCents: number;
  maxCents: number;
}) {
  const [balanceCents, setBalanceCents] = useState(passenger.balanceCents);
  const topUpActionWithBalance = async (previous: WalletActionState, formData: FormData) => {
    const state = await topUpCashAction(previous, formData);
    if (state.balanceAfterCents !== undefined) setBalanceCents(state.balanceAfterCents);
    return state;
  };
  const adjustActionWithBalance = async (previous: WalletActionState, formData: FormData) => {
    const state = await adjustBalanceAction(previous, formData);
    if (state.balanceAfterCents !== undefined) setBalanceCents(state.balanceAfterCents);
    return state;
  };
  const [topUpState, topUpFormAction, topUpPending] = useActionState<WalletActionState, FormData>(
    topUpActionWithBalance,
    { status: "idle" },
  );
  const [adjustState, adjustFormAction, adjustPending] = useActionState<
    WalletActionState,
    FormData
  >(adjustActionWithBalance, { status: "idle" });
  const [adjustmentType, setAdjustmentType] = useState<"REFUND" | "ADJUSTMENT">("REFUND");
  const min = (minCents / 100).toFixed(2);
  const max = (maxCents / 100).toFixed(2);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="font-heading text-ink text-base font-bold">{passenger.fullName}</h2>
        <p className="text-ink-muted text-xs">{passenger.email}</p>
        {passenger.phone && <p className="text-ink-muted text-xs">{passenger.phone}</p>}
        <p className="text-ink mt-2 text-sm font-bold">Saldo actual: {formatPesos(balanceCents)}</p>
      </header>

      <ActionMessage state={topUpState} />
      <form
        action={topUpFormAction}
        className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3"
      >
        <input type="hidden" name="passengerId" value={passenger.id} />
        <h3 className="font-heading text-ink text-sm font-bold">Recarga en efectivo</h3>
        <p className="text-ink-muted text-xs">
          Monto permitido: {formatPesos(minCents)} a {formatPesos(maxCents)}.
        </p>
        <label htmlFor="cash-top-up-amount" className="text-ink block text-xs font-bold">
          Monto en pesos
        </label>
        <input
          id="cash-top-up-amount"
          name="amount"
          type="number"
          min={min}
          max={max}
          step="0.01"
          required
          className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={topUpPending}
          className="bg-brand w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {topUpPending ? "Procesando..." : "Registrar recarga"}
        </button>
      </form>

      <ActionMessage state={adjustState} />
      <form
        action={adjustFormAction}
        className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3"
      >
        <input type="hidden" name="passengerId" value={passenger.id} />
        <h3 className="font-heading text-ink text-sm font-bold">Reembolso o ajuste</h3>
        <label
          htmlFor={`movement-type-${passenger.id}`}
          className="text-ink block text-xs font-bold"
        >
          Movimiento
        </label>
        <select
          id={`movement-type-${passenger.id}`}
          name="type"
          value={adjustmentType}
          onChange={(event) => setAdjustmentType(event.target.value as "REFUND" | "ADJUSTMENT")}
          className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="REFUND">Reembolso (abono)</option>
          <option value="ADJUSTMENT">Ajuste de saldo</option>
        </select>
        {adjustmentType === "ADJUSTMENT" ? (
          <div className="space-y-1">
            <label
              htmlFor={`movement-direction-${passenger.id}`}
              className="text-ink block text-xs font-bold"
            >
              Dirección del ajuste
            </label>
            <select
              id={`movement-direction-${passenger.id}`}
              name="direction"
              className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="CREDIT">Abonar</option>
              <option value="DEBIT">Descontar</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="direction" value="CREDIT" />
        )}
        <label
          htmlFor={`movement-amount-${passenger.id}`}
          className="text-ink block text-xs font-bold"
        >
          Monto en pesos
        </label>
        <input
          id={`movement-amount-${passenger.id}`}
          name="amount"
          type="number"
          min="0.01"
          max="99999999.99"
          step="0.01"
          required
          className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <label
          htmlFor={`movement-reason-${passenger.id}`}
          className="text-ink block text-xs font-bold"
        >
          Motivo obligatorio
        </label>
        <textarea
          id={`movement-reason-${passenger.id}`}
          name="reason"
          required
          maxLength={300}
          rows={2}
          className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={adjustPending}
          className="w-full rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {adjustPending ? "Procesando..." : "Aplicar movimiento"}
        </button>
      </form>
    </section>
  );
}

export function WalletManager({ minCents, maxCents }: WalletManagerProps) {
  const [searchState, searchFormAction, searchPending] = useActionState<
    PassengerSearchActionState,
    FormData
  >(searchPassengerAction, { status: "idle" });

  return (
    <div className="space-y-4">
      <form
        action={searchFormAction}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label htmlFor="passenger-contact" className="text-ink block text-xs font-bold">
          Correo o celular del pasajero
        </label>
        <input
          id="passenger-contact"
          name="contact"
          type="text"
          autoComplete="email"
          required
          className="text-ink w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={searchPending}
          className="bg-brand w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {searchPending ? "Buscando..." : "Buscar pasajero"}
        </button>
      </form>

      {searchState.status === "error" && <ActionMessage state={searchState} />}
      {searchState.passenger && (
        <PassengerActions
          key={searchState.passenger.id}
          passenger={searchState.passenger}
          minCents={minCents}
          maxCents={maxCents}
        />
      )}
    </div>
  );
}
