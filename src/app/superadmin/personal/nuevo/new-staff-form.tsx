"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { DockOption } from "@/application/staff/ports";
import {
  FieldError,
  FormAlert,
  inputClass,
  submitClass,
  SuccessBox,
} from "@/components/form-fields";

import { createStaffAction, type CreateStaffState } from "../actions";
import { TemporaryPasswordBox } from "../temporary-password-box";

function TextField(props: {
  name: "fullName" | "email" | "phone";
  label: string;
  type: string;
  autoComplete: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.name} className="font-bold">
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required
        maxLength={120}
        aria-invalid={!!props.error}
        aria-describedby={`${props.name}-error`}
        className={inputClass}
      />
      <FieldError id={`${props.name}-error`} message={props.error} />
    </div>
  );
}

/** Al pedir «Crear otra cuenta» se monta un formulario nuevo (y vacío). */
export function NewStaffForm({ docks }: { docks: DockOption[] }) {
  const [formKey, setFormKey] = useState(0);
  return <StaffForm key={formKey} docks={docks} onCreateAnother={() => setFormKey((k) => k + 1)} />;
}

function StaffForm({
  docks,
  onCreateAnother,
}: {
  docks: DockOption[];
  onCreateAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState<CreateStaffState, FormData>(
    createStaffAction,
    {},
  );
  const [role, setRole] = useState(state.values?.role ?? "ADMIN");
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  if (state.created) {
    const { created } = state;
    return (
      <div className="flex flex-col gap-4">
        <SuccessBox title="Cuenta creada">
          <p>
            {created.fullName} ({created.email}) ya puede iniciar sesión.
          </p>
        </SuccessBox>
        <TemporaryPasswordBox
          password={created.temporaryPassword}
          email={created.email}
          emailSent={created.emailSent}
        />
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/superadmin/personal/${created.id}`}
            className="text-brand-accent font-bold underline"
          >
            Ver la cuenta
          </Link>
          <button
            type="button"
            onClick={onCreateAnother}
            className="text-brand-accent font-bold underline"
          >
            Crear otra cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Tipo de cuenta</legend>
        {[
          { value: "ADMIN", label: "Administrador (taquilla de un muelle)" },
          { value: "DRIVER", label: "Chofer" },
        ].map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              value={option.value}
              checked={role === option.value}
              onChange={() => setRole(option.value)}
            />
            {option.label}
          </label>
        ))}
        <FieldError id="role-error" message={errors.role} />
      </fieldset>

      <TextField
        name="fullName"
        label="Nombre completo"
        type="text"
        autoComplete="off"
        defaultValue={values?.fullName}
        error={errors.fullName}
      />
      <TextField
        name="email"
        label="Correo electrónico"
        type="email"
        autoComplete="off"
        defaultValue={values?.email}
        error={errors.email}
      />
      <TextField
        name="phone"
        label="Celular"
        type="tel"
        autoComplete="off"
        defaultValue={values?.phone}
        error={errors.phone}
      />

      {role === "ADMIN" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="dockId" className="font-bold">
            Muelle
          </label>
          <select
            id="dockId"
            name="dockId"
            required
            defaultValue={values?.dockId ?? ""}
            aria-invalid={!!errors.dockId}
            aria-describedby="dockId-error"
            className={inputClass}
          >
            <option value="" disabled>
              Elige un muelle
            </option>
            {docks.map((dock) => (
              <option key={dock.id} value={dock.id}>
                {dock.name}
              </option>
            ))}
          </select>
          <FieldError id="dockId-error" message={errors.dockId} />
        </div>
      )}

      <FormAlert message={state.error} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
