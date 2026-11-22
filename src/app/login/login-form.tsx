"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-left font-bold">
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          defaultValue={state.email}
          className="border-line h-12 rounded-xl border bg-white px-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-left font-bold">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          className="border-line h-12 rounded-xl border bg-white px-3 font-normal"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
