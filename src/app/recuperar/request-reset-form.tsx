"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert, inputClass, submitClass, SuccessBox } from "@/components/form-fields";

import { requestResetAction, type RequestResetState } from "./actions";

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestResetAction,
    {},
  );

  if (state.sentTo) {
    return (
      <SuccessBox title="Revisa tu correo">
        <p>
          Si <strong>{state.sentTo}</strong> tiene una cuenta, te enviamos un enlace para elegir una
          contraseña nueva. Vence en 30 minutos. Si no lo ves, revisa la carpeta de spam.
        </p>
      </SuccessBox>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4 text-left">
      <label className="flex flex-col gap-1 font-bold">
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          defaultValue={state.email}
          className={inputClass}
        />
      </label>
      <FormAlert message={state.error} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
      <p className="text-ink-muted text-center text-sm">
        <Link href="/login" className="text-brand-accent font-bold underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
