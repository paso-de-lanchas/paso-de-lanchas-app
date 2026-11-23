"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FieldError, inputClass } from "@/components/form-fields";

import { registerAction, type RegisterState } from "./actions";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(registerAction, {});
  const errors = state.fieldErrors ?? {};

  if (state.sentTo) {
    return (
      <div
        role="status"
        className="bg-success-bg text-success-ink flex flex-col gap-2 rounded-2xl p-4 text-left"
      >
        <p className="font-bold">Revisa tu correo</p>
        <p>
          Enviamos un enlace a <strong>{state.sentTo}</strong> para activar tu cuenta. Vence en 24
          horas. Si no lo ves, revisa la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4 text-left">
      <label className="flex flex-col gap-1 font-bold">
        Nombre completo
        <input
          name="fullName"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={state.values?.fullName}
          aria-invalid={!!errors.fullName}
          aria-describedby="fullName-error"
          className={inputClass}
        />
        <FieldError id="fullName-error" message={errors.fullName} />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          defaultValue={state.values?.email}
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          className={inputClass}
        />
        <FieldError id="email-error" message={errors.email} />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        Celular
        <input
          name="phone"
          type="tel"
          autoComplete="tel-national"
          inputMode="tel"
          required
          maxLength={20}
          placeholder="10 dígitos"
          defaultValue={state.values?.phone}
          aria-invalid={!!errors.phone}
          aria-describedby="phone-error"
          className={inputClass}
        />
        <FieldError id="phone-error" message={errors.phone} />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          aria-invalid={!!errors.password}
          aria-describedby="password-help password-error"
          className={inputClass}
        />
        <span id="password-help" className="text-ink-muted text-sm font-normal">
          Mínimo 8 caracteres, con al menos una letra y un número.
        </span>
        <FieldError id="password-error" message={errors.password} />
      </label>

      <div className="border-line flex flex-col gap-2 rounded-2xl border bg-white p-4 text-sm">
        <p className="font-bold">Aviso de privacidad</p>
        <p className="text-ink-muted">
          Usamos tu nombre, correo y celular solo para tu cuenta, tu saldo y tus viajes. No los
          compartimos con nadie más.
        </p>
        <label className="flex items-start gap-2 font-bold">
          <input
            type="checkbox"
            name="acceptPrivacy"
            required
            aria-describedby="acceptPrivacy-error"
            className="mt-1 size-5"
          />
          Leí y acepto el aviso de privacidad
        </label>
        <FieldError id="acceptPrivacy-error" message={errors.acceptPrivacy} />
      </div>

      {state.error && !state.fieldErrors && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </button>
      <p className="text-ink-muted text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-brand-accent font-bold underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
