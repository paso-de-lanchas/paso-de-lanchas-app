"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FormAlert,
  NEW_PASSWORD_HELP,
  PasswordField,
  submitClass,
  SuccessBox,
} from "@/components/form-fields";

import { resetPasswordAction, type ResetState } from "../actions";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  if (state.done) {
    return (
      <SuccessBox title="¡Listo! Tu contraseña cambió.">
        <p>Cerramos tus sesiones abiertas. Entra con tu contraseña nueva.</p>
        <Link href="/login" className="font-bold underline">
          Iniciar sesión
        </Link>
      </SuccessBox>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4 text-left">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="password"
        label="Contraseña nueva"
        autoComplete="new-password"
        help={NEW_PASSWORD_HELP}
        error={errors.password}
      />
      <PasswordField
        name="confirmPassword"
        label="Repite la contraseña nueva"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />
      <FormAlert message={state.error} />
      {state.error && (
        <Link href="/recuperar" className="text-brand-accent text-center font-bold underline">
          Pedir un enlace nuevo
        </Link>
      )}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
