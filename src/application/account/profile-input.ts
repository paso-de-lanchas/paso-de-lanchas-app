import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string({ error: "El nombre completo es obligatorio" })
    .trim()
    .min(1, "El nombre completo es obligatorio")
    .max(120, "El nombre no puede exceder 120 caracteres"),
  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => (typeof val === "string" ? val.trim() : ""))
    .refine((val) => val === "" || /^\d{10}$/.test(val), {
      message: "El número de celular debe tener exactamente 10 dígitos",
    })
    .transform((val) => (val === "" ? null : val)),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
