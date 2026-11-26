import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import { InputError } from "@/application/shared/input-error";
import type { DriverRepository, DriverSummary } from "./ports";

export const updateDriverSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "El nombre completo debe tener al menos 2 caracteres.")
    .max(120, "El nombre completo no puede exceder 120 caracteres."),
  photoUrl: z
    .string()
    .trim()
    .max(500, "La URL de la fotografía es demasiado larga.")
    .refine(
      (value) => value === "" || value.startsWith("https://") || value.startsWith("/"),
      "La URL de la fotografía debe iniciar con https:// o /.",
    )
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(20, "El teléfono no puede exceder 20 caracteres.")
    .regex(
      /^[0-9+\-\s()]*$/,
      "El teléfono solo puede contener dígitos y símbolos (+, -, espacios).",
    )
    .optional()
    .nullable(),
});

export interface UpdateDriverInput {
  driverId: string;
  fullName: string;
  photoUrl?: string | null;
  phone?: string | null;
}

export function createUpdateDriver(repository: DriverRepository) {
  return async function execute(input: UpdateDriverInput): Promise<DriverSummary> {
    const parsed = updateDriverSchema.safeParse({
      fullName: input.fullName,
      photoUrl: input.photoUrl ?? null,
      phone: input.phone ?? null,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue?.path[0] ?? "fullName");
      throw new InputError({
        [field]: issue?.message ?? "Datos del chofer inválidos.",
      });
    }

    const driver = await repository.findDriverById(input.driverId);
    if (!driver || driver.deletedAt !== null) {
      throw new DomainError("DRIVER_NOT_FOUND", "El chofer no existe.");
    }

    if (driver.role !== "DRIVER") {
      throw new DomainError(
        "USER_NOT_DRIVER",
        "El usuario seleccionado no tiene el rol de chofer.",
      );
    }

    const normalizedPhoto =
      parsed.data.photoUrl && parsed.data.photoUrl.length > 0 ? parsed.data.photoUrl : null;
    const normalizedPhone =
      parsed.data.phone && parsed.data.phone.length > 0 ? parsed.data.phone : null;

    return repository.updateDriverProfile(input.driverId, {
      fullName: parsed.data.fullName,
      photoUrl: normalizedPhoto,
      phone: normalizedPhone,
    });
  };
}
