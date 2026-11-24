import { z } from "zod";

import { normalizeMexicanPhone } from "@/domain/auth/phone";
import { ACCOUNT_STATUSES, STAFF_ROLES } from "@/domain/staff/staff-rules";

import { emailSchema } from "../auth/password-schema";

/** Alta de una cuenta del personal (RF-116, RF-117). */
export const newStaffSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Escribe el nombre completo.")
      .max(120, "El nombre es demasiado largo."),
    email: emailSchema,
    phone: z.string().transform((value, ctx) => {
      const phone = normalizeMexicanPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Escribe el celular a 10 dígitos." });
        return z.NEVER;
      }
      return phone;
    }),
    role: z.enum(STAFF_ROLES, { error: "Elige si es administrador o chofer." }),
    dockId: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || null)
      .pipe(z.uuid("Elige un muelle.").nullable()),
  })
  .superRefine((data, ctx) => {
    if (data.role === "ADMIN" && !data.dockId) {
      ctx.addIssue({
        code: "custom",
        path: ["dockId"],
        message: "El administrador necesita un muelle.",
      });
    }
  });

export interface NewStaffInput {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  dockId?: string;
}
export type NewStaffField = keyof NewStaffInput;

/** Filtros de la lista del personal: un valor desconocido se ignora (muestra todos). */
export const staffFilterSchema = z.object({
  role: z.enum(STAFF_ROLES).optional().catch(undefined),
  status: z.enum(ACCOUNT_STATUSES).optional().catch(undefined),
});

export const staffIdSchema = z.uuid();
