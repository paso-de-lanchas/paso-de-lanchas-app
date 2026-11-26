"use client";

import { useActionState, useState } from "react";

import { PrivacyNoticeContent } from "@/components/privacy-notice";
import { getProfileInitials } from "@/domain/account/passenger-profile";

import { type ProfileActionState, updatePassengerProfileAction } from "./actions";

interface ProfileFormProps {
  profile: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    photoUrl: string | null;
    privacyAcceptedAtIso: string | null;
  };
}

const initialState: ProfileActionState = { status: "idle" };

function formatAcceptanceDate(isoDate: string | null): string {
  if (!isoDate) {
    return "Pendiente de aceptación";
  }
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date(isoDate));
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updatePassengerProfileAction, initialState);
  const [showPrivacyText, setShowPrivacyText] = useState(false);

  const initials = getProfileInitials(profile.fullName);

  return (
    <div className="space-y-5">
      {/* Encabezado de perfil y foto (campo deshabilitado según #16) */}
      <section className="border-line rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="bg-brand font-heading flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-ink truncate text-base font-bold">{profile.fullName}</p>
            <p className="text-ink-muted truncate text-xs">{profile.email}</p>
            <span className="bg-success-bg text-success-ink mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold">
              Pasajero activo
            </span>
          </div>
        </div>

        <div className="border-line mt-4 border-t pt-4">
          <label htmlFor="profile-photo-disabled" className="text-ink block text-xs font-bold">
            Foto de perfil (opcional)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="profile-photo-disabled"
              type="file"
              accept="image/*"
              disabled
              aria-describedby="photo-disabled-hint"
              className="border-line bg-surface text-ink-muted block w-full cursor-not-allowed rounded-xl border px-3 py-2 text-xs opacity-60 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
            />
          </div>
          <p id="photo-disabled-hint" className="text-ink-muted mt-1 text-[11px]">
            Subida de fotografía temporalmente deshabilitada mientras se habilita el almacenamiento
            de archivos.
          </p>
        </div>
      </section>

      {/* Formulario de datos personales */}
      <form
        action={formAction}
        className="border-line space-y-4 rounded-2xl border bg-white p-5 shadow-xs"
      >
        <h2 className="font-heading text-ink text-base font-bold">Datos personales</h2>

        {state.status === "success" && state.message ? (
          <p
            role="status"
            className="bg-success-bg text-success-ink rounded-xl px-3.5 py-2.5 text-xs font-bold"
          >
            {state.message}
          </p>
        ) : null}

        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700"
          >
            {state.message}
          </p>
        ) : null}

        <div>
          <label htmlFor="email" className="text-ink block text-xs font-bold">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={profile.email}
            disabled
            readOnly
            className="border-line bg-surface text-ink-muted mt-1 block w-full cursor-not-allowed rounded-xl border px-3.5 py-2.5 text-sm"
          />
          <p className="text-ink-muted mt-1 text-[11px]">
            El correo electrónico está vinculado a tu cuenta y no se edita desde aquí.
          </p>
        </div>

        <div>
          <label htmlFor="fullName" className="text-ink block text-xs font-bold">
            Nombre completo <span className="text-red-600">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            maxLength={120}
            defaultValue={profile.fullName}
            placeholder="Tu nombre y apellidos"
            className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="phone" className="text-ink block text-xs font-bold">
            Número de celular (10 dígitos, opcional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            defaultValue={profile.phone ?? ""}
            placeholder="Ej. 9211234567"
            className="border-line text-ink focus:border-brand mt-1 block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm focus:outline-none"
          />
          <p className="text-ink-muted mt-1 text-[11px]">
            Déjalo vacío si no deseas registrar un número telefónico.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-brand hover:bg-brand-accent w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando cambios..." : "Guardar cambios"}
        </button>
      </form>

      {/* Aviso de privacidad aceptado (RF-014) */}
      <section className="border-line rounded-2xl border bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-ink text-sm font-bold">
              Aviso de Privacidad (LFPDPPP)
            </h2>
            <p className="text-ink-muted mt-0.5 text-xs">
              Estado:{" "}
              <span className="text-ink font-bold">
                {profile.privacyAcceptedAtIso ? "Aceptado" : "Pendiente"}
              </span>
            </p>
            {profile.privacyAcceptedAtIso ? (
              <p className="text-ink-muted text-[11px]">
                Fecha de aceptación: {formatAcceptanceDate(profile.privacyAcceptedAtIso)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowPrivacyText((prev) => !prev)}
            className="border-line text-brand hover:bg-surface shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
          >
            {showPrivacyText ? "Ocultar" : "Consultar"}
          </button>
        </div>

        {showPrivacyText ? (
          <div className="border-line bg-surface mt-3 max-h-64 overflow-y-auto rounded-xl border p-3">
            <PrivacyNoticeContent />
          </div>
        ) : null}
      </section>
    </div>
  );
}
