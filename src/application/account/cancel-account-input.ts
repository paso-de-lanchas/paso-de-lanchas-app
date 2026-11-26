import { z } from "zod";

import { PASSWORD_MAX_LENGTH } from "@/domain/auth/password-policy";

export const cancelAccountSchema = z.object({
  currentPassword: z
    .string({ error: "Escribe tu contraseña actual." })
    .min(1, "Escribe tu contraseña actual.")
    .max(PASSWORD_MAX_LENGTH + 1),
  confirmationWord: z
    .string({ error: "Escribe CANCELAR para confirmar." })
    .trim()
    .refine((value) => value.toUpperCase() === "CANCELAR", {
      message: "Debes escribir la palabra CANCELAR para confirmar.",
    }),
  acknowledgeBalanceLoss: z.boolean().optional().default(false),
});

export type CancelAccountInput = z.infer<typeof cancelAccountSchema>;
