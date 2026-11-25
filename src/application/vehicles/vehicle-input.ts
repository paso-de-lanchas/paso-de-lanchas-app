import { z } from "zod";

import {
  isValidPhotoUrl,
  isValidPlate,
  normalizePlate,
  VEHICLE_BRAND_MAX_LENGTH,
  VEHICLE_COLOR_MAX_LENGTH,
  VEHICLE_MODEL_MAX_LENGTH,
  VEHICLE_PLATE_MAX_LENGTH,
  VEHICLE_PLATE_MIN_LENGTH,
} from "@/domain/vehicles/vehicle";

export const vehicleSchema = z.object({
  vehicleTypeId: z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === "string" ? Number(value.trim()) : value))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: "Selecciona un tipo de vehículo.",
    }),
  brand: z
    .string({ error: "La marca es obligatoria." })
    .trim()
    .min(1, "La marca es obligatoria.")
    .max(
      VEHICLE_BRAND_MAX_LENGTH,
      `La marca no puede exceder ${VEHICLE_BRAND_MAX_LENGTH} caracteres.`,
    ),
  model: z
    .string({ error: "El modelo es obligatorio." })
    .trim()
    .min(1, "El modelo es obligatorio.")
    .max(
      VEHICLE_MODEL_MAX_LENGTH,
      `El modelo no puede exceder ${VEHICLE_MODEL_MAX_LENGTH} caracteres.`,
    ),
  color: z
    .string({ error: "El color es obligatorio." })
    .trim()
    .min(1, "El color es obligatorio.")
    .max(
      VEHICLE_COLOR_MAX_LENGTH,
      `El color no puede exceder ${VEHICLE_COLOR_MAX_LENGTH} caracteres.`,
    ),
  plate: z
    .string({ error: "Las placas son obligatorias." })
    .transform((value) => normalizePlate(value))
    .refine((value) => value.length >= VEHICLE_PLATE_MIN_LENGTH, {
      message: `Las placas deben tener al menos ${VEHICLE_PLATE_MIN_LENGTH} caracteres.`,
    })
    .refine((value) => value.length <= VEHICLE_PLATE_MAX_LENGTH, {
      message: `Las placas no pueden exceder ${VEHICLE_PLATE_MAX_LENGTH} caracteres.`,
    })
    .refine((value) => isValidPlate(value), {
      message: "Las placas solo pueden contener letras y números.",
    }),
  photoUrl: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .refine((value) => value === "" || isValidPhotoUrl(value), {
      message: "Ingresa una URL válida (http:// o https://) para la fotografía.",
    })
    .transform((value) => (value === "" ? null : value)),
});

export type VehicleField = keyof z.input<typeof vehicleSchema>;
export type VehicleInput = z.input<typeof vehicleSchema>;
export type ValidatedVehicleData = z.output<typeof vehicleSchema>;
