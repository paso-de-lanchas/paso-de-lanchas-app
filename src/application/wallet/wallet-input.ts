import { z } from "zod";

import { normalizeMexicanPhone } from "@/domain/auth/phone";

const contactSchema = z
  .string()
  .trim()
  .min(1, "Escribe el correo o celular del pasajero.")
  .max(120, "El dato de búsqueda es demasiado largo.")
  .transform((value) => {
    if (value.includes("@")) return value.toLowerCase();
    return normalizeMexicanPhone(value) ?? "";
  })
  .refine(
    (value) =>
      value.includes("@") ? z.string().email().safeParse(value).success : /^\d{10}$/.test(value),
    "Ingresa un correo válido o un celular mexicano de 10 dígitos.",
  );

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Ingresa un monto válido con hasta dos decimales.");

export const searchPassengerSchema = z.object({ contact: contactSchema });

export const topUpCashSchema = z.object({
  passengerId: z.string().uuid("Selecciona un pasajero válido."),
  amount: amountSchema,
});

export const adjustBalanceSchema = z.object({
  passengerId: z.string().uuid("Selecciona un pasajero válido."),
  type: z.enum(["REFUND", "ADJUSTMENT"]),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: amountSchema,
  reason: z
    .string()
    .trim()
    .min(1, "El motivo es obligatorio.")
    .max(300, "El motivo no puede exceder 300 caracteres."),
});

export const transactionIdSchema = z.object({
  id: z.string().uuid("El movimiento solicitado no es válido."),
});

export const transactionPageSchema = z.coerce
  .number({ error: "La página no es válida." })
  .int("La página debe ser un número entero.")
  .min(1, "La página debe ser mayor que cero.")
  .max(10_000, "La página solicitada está fuera de rango.");
