"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AccountCancellationPreview } from "@/application/account/cancel-account";
import { PasswordField } from "@/components/form-fields";

import { type CancelAccountActionState, cancelAccountAction } from "./actions";

const INITIAL_STATE: CancelAccountActionState = { status: "idle" };

interface CancelAccountFormProps {
  preview: AccountCancellationPreview;
}

export function CancelAccountForm({ preview }: CancelAccountFormProps) {
  const [state, formAction, isPending] = useActionState(cancelAccountAction, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="border-line space-y-5 rounded-2xl border bg-white p-5 shadow-xs"
    >
      <div className="space-y-2">
        <p className="text-ink text-sm font-semibold">
          Cuenta: <span className="font-normal">{preview.fullName}</span> ({preview.email})
        </p>
        <p className="text-ink-muted text-xs leading-relaxed">
          Esta acción es permanente. Al confirmar:
        </p>
        <ul className="text-ink-muted list-disc space-y-1 pl-5 text-xs">
          <li>Se eliminarán tu nombre, correo electrónico, celular y fotografía de perfil.</li>
          <li>Se revocarán tus credenciales QR y se cerrarán todas tus sesiones activas.</li>
          <li>
            El historial financiero de ventas y recargas se conservará de forma anónima para
            reportes operativos.
          </li>
        </ul>
      </div>

      {preview.warning.hasBalance && preview.warning.message ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"
        >
          <p className="font-bold">
            Aviso de saldo disponible ({preview.warning.formattedBalance})
          </p>
          <p className="leading-relaxed">{preview.warning.message}</p>
          <label className="flex items-start gap-2.5 font-medium">
            <input
              type="checkbox"
              name="acknowledgeBalanceLoss"
              required
              className="mt-0.5 h-4 w-4 rounded border-amber-400"
            />
            <span>
              Entiendo que perderé mi saldo de {preview.warning.formattedBalance} de forma
              permanente al cancelar mi cuenta.
            </span>
          </label>
        </div>
      ) : null}

      <PasswordField
        name="currentPassword"
        label="Contraseña actual"
        autoComplete="current-password"
      />

      <div className="space-y-1.5">
        <label htmlFor="confirmationWord" className="text-ink block text-xs font-bold">
          Escribe <span className="font-mono text-red-700">CANCELAR</span> para confirmar
        </label>
        <input
          id="confirmationWord"
          name="confirmationWord"
          type="text"
          placeholder="CANCELAR"
          autoComplete="off"
          required
          className="border-line text-ink w-full rounded-xl border bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
        />
      </div>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
        >
          {isPending ? "Cancelando cuenta..." : "Confirmar cancelación definitiva"}
        </button>
        <Link
          href="/pasajero/cuenta"
          className="border-line text-ink-muted hover:text-ink w-full rounded-xl border px-4 py-2 text-center text-xs font-semibold transition"
        >
          Conservar mi cuenta
        </Link>
      </div>
    </form>
  );
}
