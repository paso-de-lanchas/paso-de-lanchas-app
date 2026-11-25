"use client";

import { useActionState } from "react";

import { FormAlert, SuccessBox } from "@/components/form-fields";
import type { AccountStatusCode } from "@/domain/staff/staff-rules";

import {
  changeStaffStatusAction,
  resetStaffPasswordAction,
  type StaffActionState,
  unlockStaffAction,
} from "../actions";
import { TemporaryPasswordBox } from "../temporary-password-box";

const buttonClass =
  "border-line text-brand rounded-xl border bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-60";

function Result({ state }: { state: StaffActionState }) {
  return (
    <>
      <FormAlert message={state.error} />
      {state.done && (
        <SuccessBox title="Listo">
          <p>{state.done}</p>
        </SuccessBox>
      )}
    </>
  );
}

interface StaffActionsProps {
  staffId: string;
  email: string;
  status: AccountStatusCode;
  canUnlock: boolean;
}

/** Desactivar/reactivar, desbloquear y restablecer la contraseña (RF-118, RF-119). */
export function StaffActions({ staffId, email, status, canUnlock }: StaffActionsProps) {
  const [statusState, statusAction, statusPending] = useActionState<StaffActionState, FormData>(
    changeStaffStatusAction.bind(null, staffId),
    {},
  );
  const [unlockState, unlockAction, unlockPending] = useActionState<StaffActionState, FormData>(
    unlockStaffAction.bind(null, staffId),
    {},
  );
  const [resetState, resetAction, resetPending] = useActionState<StaffActionState, FormData>(
    resetStaffPasswordAction.bind(null, staffId),
    {},
  );
  const active = status === "ACTIVE";

  return (
    <section className="flex flex-col gap-6" aria-label="Acciones de la cuenta">
      <div className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-5">
        <h2 className="font-bold">{active ? "Desactivar la cuenta" : "Reactivar la cuenta"}</h2>
        <p className="text-ink-muted text-sm">
          {active
            ? "Ya no podrá iniciar sesión y se cerrarán sus sesiones abiertas al instante."
            : "Podrá volver a iniciar sesión con su contraseña."}
        </p>
        <form action={statusAction}>
          <input type="hidden" name="change" value={active ? "DEACTIVATE" : "REACTIVATE"} />
          <button type="submit" disabled={statusPending} className={buttonClass}>
            {active ? "Desactivar cuenta" : "Reactivar cuenta"}
          </button>
        </form>
        <Result state={statusState} />
      </div>

      <div className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-5">
        <h2 className="font-bold">Desbloquear</h2>
        <p className="text-ink-muted text-sm">
          {canUnlock
            ? "Borra los intentos fallidos y el bloqueo temporal para que pueda volver a entrar."
            : "No tiene intentos fallidos ni bloqueo."}
        </p>
        {canUnlock && (
          <form action={unlockAction}>
            <button type="submit" disabled={unlockPending} className={buttonClass}>
              Desbloquear cuenta
            </button>
          </form>
        )}
        <Result state={unlockState} />
      </div>

      <div className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-5">
        <h2 className="font-bold">Restablecer la contraseña</h2>
        <p className="text-ink-muted text-sm">
          Genera una contraseña temporal nueva, cierra sus sesiones y le pedirá cambiarla al entrar.
        </p>
        <form action={resetAction}>
          <button type="submit" disabled={resetPending} className={buttonClass}>
            Restablecer contraseña
          </button>
        </form>
        <Result state={resetState} />
        {resetState.temporaryPassword && (
          <TemporaryPasswordBox
            password={resetState.temporaryPassword}
            email={email}
            emailSent={!!resetState.emailSent}
          />
        )}
      </div>
    </section>
  );
}
