import { z } from "zod";

import { normalizeEmail } from "@/domain/auth/email";
import { PASSWORD_MAX_LENGTH, passwordProblem } from "@/domain/auth/password-policy";

/** Correo escrito por el usuario: se normaliza y se valida. */
export const emailSchema = z
  .string()
  .max(120, "El correo es demasiado largo.")
  .transform(normalizeEmail)
  .pipe(z.email("Escribe un correo válido."));

/** Contraseña nueva: aplica la política de `password-policy.ts`. */
export const newPasswordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH + 1)
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** Contraseña nueva escrita dos veces: las dos deben coincidir. */
export const confirmedPasswordSchema = {
  password: newPasswordSchema,
  confirmPassword: z.string().max(PASSWORD_MAX_LENGTH + 1),
};

export const PASSWORDS_DIFFER = "Las contraseñas no coinciden.";
