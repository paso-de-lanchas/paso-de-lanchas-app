import { DomainError } from "@/domain/shared/domain-error";

export const VEHICLE_BRAND_MAX_LENGTH = 40;
export const VEHICLE_MODEL_MAX_LENGTH = 40;
export const VEHICLE_COLOR_MAX_LENGTH = 30;
export const VEHICLE_PLATE_MIN_LENGTH = 4;
export const VEHICLE_PLATE_MAX_LENGTH = 15;

const PLATE_PATTERN = /^[A-Z0-9]+$/;

/** Normaliza placas a mayúsculas, sin espacios ni guiones. */
export function normalizePlate(raw: string): string {
  return raw
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

export function isValidPlate(normalizedPlate: string): boolean {
  return (
    normalizedPlate.length >= VEHICLE_PLATE_MIN_LENGTH &&
    normalizedPlate.length <= VEHICLE_PLATE_MAX_LENGTH &&
    PLATE_PATTERN.test(normalizedPlate)
  );
}

export function isValidPhotoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface VehicleDraft {
  vehicleTypeId: number;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoUrl: string | null;
}

export function assertValidVehicleDraft(draft: VehicleDraft): void {
  if (!Number.isInteger(draft.vehicleTypeId) || draft.vehicleTypeId <= 0) {
    throw new DomainError("INVALID_VEHICLE", "Selecciona un tipo de vehículo válido.");
  }
  const brand = draft.brand.trim();
  if (brand.length === 0 || brand.length > VEHICLE_BRAND_MAX_LENGTH) {
    throw new DomainError("INVALID_VEHICLE", "La marca del vehículo no es válida.");
  }
  const model = draft.model.trim();
  if (model.length === 0 || model.length > VEHICLE_MODEL_MAX_LENGTH) {
    throw new DomainError("INVALID_VEHICLE", "El modelo del vehículo no es válido.");
  }
  const color = draft.color.trim();
  if (color.length === 0 || color.length > VEHICLE_COLOR_MAX_LENGTH) {
    throw new DomainError("INVALID_VEHICLE", "El color del vehículo no es válido.");
  }
  const normalized = normalizePlate(draft.plate);
  if (!isValidPlate(normalized)) {
    throw new DomainError(
      "INVALID_PLATE",
      "Las placas deben tener entre 4 y 15 caracteres alfanuméricos.",
    );
  }
  if (draft.photoUrl !== null && !isValidPhotoUrl(draft.photoUrl)) {
    throw new DomainError("INVALID_PHOTO_URL", "La URL de la fotografía no es válida.");
  }
}
