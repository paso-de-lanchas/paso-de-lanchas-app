"use client";

import { useActionState } from "react";

import {
  startOnlineTopUpAction,
  type OnlineTopUpActionState,
} from "@/app/pasajero/saldo/recargar/actions";
import type { TopUpLimits } from "@/application/payments/ports";

const initialState: OnlineTopUpActionState = { status: "idle" };

export function TopUpForm({ limits }: { limits: TopUpLimits }) {
  const [state, action, pending] = useActionState(startOnlineTopUpAction, initialState);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="amount" className="text-ink block text-sm font-semibold">
          Monto de la recarga
        </label>
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden="true">$</span>
          <input
            id="amount"
            name="amount"
            type="number"
            min={limits.minimum.toDecimalString()}
            max={limits.maximum.toDecimalString()}
            step="0.01"
            inputMode="decimal"
            required
            className="focus:border-brand min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none"
          />
        </div>
        <p className="text-ink-muted mt-2 text-xs">
          Puedes recargar de {limits.minimum.format()} a {limits.maximum.format()} MXN.
        </p>
      </div>
      <p className="text-ink-muted text-xs">
        El pago se realiza en Mercado Pago. Esta aplicación no recibe ni guarda datos de tu tarjeta.
      </p>
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-dark min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Conectando con Mercado Pago..." : "Pagar con Mercado Pago"}
      </button>
    </form>
  );
}
