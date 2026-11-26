import { z } from "zod";

export const ALLOWED_CREDENTIAL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_CREDENTIAL_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const requestDiscountSchema = z.object({
  discountType: z.enum(["STUDENT", "INAPAM"], {
    error: "Selecciona un tipo de descuento válido (Estudiante o INAPAM).",
  }),
  credentialPhotoPath: z
    .string({ error: "La fotografía de la credencial es obligatoria." })
    .trim()
    .min(1, "La fotografía de la credencial es obligatoria."),
});

export const credentialFileMetaSchema = z.object({
  type: z.enum(ALLOWED_CREDENTIAL_MIME_TYPES, {
    error: "La credencial debe ser una imagen JPG, PNG o WebP.",
  }),
  size: z
    .number()
    .int()
    .positive("El archivo de la credencial está vacío.")
    .max(MAX_CREDENTIAL_FILE_BYTES, "La imagen no puede pesar más de 5 MB."),
});

export const approveDiscountSchema = z.object({
  requestId: z.string().trim().min(1, "El identificador de la solicitud es obligatorio."),
  decision: z.literal("APPROVE"),
  validUntil: z.coerce.date({ error: "Indica una fecha de vencimiento válida." }),
});

export const rejectDiscountSchema = z.object({
  requestId: z.string().trim().min(1, "El identificador de la solicitud es obligatorio."),
  decision: z.literal("REJECT"),
  rejectionReason: z
    .string({ error: "Debes indicar el motivo del rechazo." })
    .trim()
    .min(1, "Debes indicar el motivo del rechazo.")
    .max(300, "El motivo del rechazo no puede exceder 300 caracteres."),
});

export const reviewDiscountSchema = z.discriminatedUnion("decision", [
  approveDiscountSchema,
  rejectDiscountSchema,
]);
