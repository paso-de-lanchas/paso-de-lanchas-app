"use server";

import { InputError } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { requestPasswordReset, resetPassword } from "@/lib/auth/auth";

export interface RequestResetState {
  error?: string;
  email?: string;
  /** Correo al que se mandó (o se habría mandado) el enlace. */
  sentTo?: string;
}

/** "¿Olvidaste tu contraseña?" (RF-005). */
export async function requestResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "");
  try {
    const result = await requestPasswordReset({ email });
    return { sentTo: result.email };
  } catch (error) {
    if (error instanceof InputError) {
      return { error: error.fieldErrors.email ?? error.message, email };
    }
    console.error("Recuperar contraseña: no se pudo completar", (error as Error).name);
    return { error: "No pudimos enviarte el correo. Intenta de nuevo en unos minutos.", email };
  }
}

export interface ResetState {
  done?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string>>;
}

/** Elegir contraseña nueva con el enlace del correo (RF-005). */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  try {
    await resetPassword(String(formData.get("token") ?? ""), {
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    return { done: true };
  } catch (error) {
    if (error instanceof InputError) return { fieldErrors: error.fieldErrors };
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
