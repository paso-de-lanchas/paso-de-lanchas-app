"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { verifyEmailAction, type VerifyState } from "./actions";

/**
 * El enlace del correo abre esta página y la cuenta se activa al presionar el botón (no al
 * abrir el enlace), para que los revisores automáticos de correo no gasten el enlace.
 */
export function VerifyForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(verifyEmailAction, {});

  if (state.verified) {
    return (
      <div role="status" className="flex w-full flex-col gap-4">
        <p className="bg-success-bg text-success-ink rounded-2xl p-4">
          ¡Listo! Tu cuenta está activa.
        </p>
        <Link
          href="/login"
          className="bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !token}
        className="bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "Confirmando…" : "Confirmar mi correo"}
      </button>
      {!token && (
        <p className="text-ink-muted text-sm">Abre esta página desde el enlace de tu correo.</p>
      )}
    </form>
  );
}
