import { z } from "zod";

import { parseMexicoDateTimeInput } from "@/domain/announcements/announcement";

export const publishAnnouncementSchema = z.object({
  title: z
    .string({ error: "El título del aviso es obligatorio." })
    .trim()
    .min(3, "El título debe tener al menos 3 caracteres.")
    .max(120, "El título no puede exceder 120 caracteres."),
  message: z
    .string({ error: "El mensaje del aviso es obligatorio." })
    .trim()
    .min(5, "El mensaje debe tener al menos 5 caracteres.")
    .max(1000, "El mensaje no puede exceder 1,000 caracteres."),
  dockId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value || value === "ALL" ? null : value))
    .pipe(z.string().uuid("El muelle seleccionado no es válido.").nullable()),
  startsAtRaw: z.string().trim().optional().default(""),
  endsAtRaw: z.string().trim().optional().default(""),
});

export const closeAnnouncementSchema = z.object({
  announcementId: z
    .string({ error: "El identificador del aviso es obligatorio." })
    .trim()
    .uuid("El identificador del aviso no es válido."),
});

export function parseAnnouncementSchedule(
  startsAtRaw: string,
  endsAtRaw: string,
  now: Date,
): { ok: true; startsAt: Date; endsAt: Date | null } | { ok: false; message: string } {
  let startsAt = now;
  if (startsAtRaw.length > 0) {
    const parsedStart = parseMexicoDateTimeInput(startsAtRaw);
    if (!parsedStart) {
      return { ok: false, message: "La fecha y hora de inicio no son válidas." };
    }
    startsAt = parsedStart;
  }

  let endsAt: Date | null = null;
  if (endsAtRaw.length > 0) {
    const parsedEnd = parseMexicoDateTimeInput(endsAtRaw);
    if (!parsedEnd) {
      return { ok: false, message: "La fecha y hora de fin no son válidas." };
    }
    endsAt = parsedEnd;
  }

  if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
    return {
      ok: false,
      message: "La fecha de fin de vigencia debe ser posterior al inicio.",
    };
  }

  return { ok: true, startsAt, endsAt };
}
