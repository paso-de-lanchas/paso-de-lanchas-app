"use server";

import { RegistrationInputError, type RegisterField } from "@/application/auth/register-passenger";
import { registerPassenger } from "@/lib/auth/auth";

export interface RegisterState {
  fieldErrors?: Partial<Record<RegisterField, string>>;
  error?: string;
  /** Lo que escribió, para no hacerle repetirlo si hubo un error (nunca la contraseña). */
  values?: { fullName: string; email: string; phone: string };
  /** Correo al que se mandó el enlace: el registro terminó. */
  sentTo?: string;
}

/** Formulario de registro de pasajero (RF-001). */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  try {
    const { email } = await registerPassenger({
      ...values,
      password: String(formData.get("password") ?? ""),
      acceptPrivacy: formData.get("acceptPrivacy") === "on",
    });
    return { sentTo: email };
  } catch (error) {
    if (error instanceof RegistrationInputError) {
      return { fieldErrors: error.fieldErrors, error: error.message, values };
    }
    // Lo más probable: falló el envío del correo. Se registra sin datos personales.
    console.error("Registro: no se pudo completar", (error as Error).name);
    return {
      error: "No pudimos enviarte el correo. Intenta de nuevo en unos minutos.",
      values,
    };
  }
}
