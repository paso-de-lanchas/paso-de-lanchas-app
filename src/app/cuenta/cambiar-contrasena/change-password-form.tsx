"use client";

import { useActionState } from "react";

import { FormAlert, NEW_PASSWORD_HELP, PasswordField, submitClass } from "@/components/form-fields";

import { changePasswordAction, type ChangePasswordState } from "./actions";

export function ChangePasswordForm({ temporary }: { temporary: boolean }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex w-full flex-col gap-4 text-left">
      <PasswordField
        name="currentPassword"
        label={temporary ? "Contraseña temporal" : "Contraseña actual"}
        autoComplete="current-password"
        error={errors.currentPassword}
      />
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
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
      <p className="text-ink-muted text-center text-sm">
        Al cambiarla se cierran tus sesiones en otros dispositivos.
      </p>
    </form>
  );
}
