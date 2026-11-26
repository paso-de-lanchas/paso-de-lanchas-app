export interface PassengerProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  photoUrl: string | null;
  privacyAcceptedAt: Date | null;
}

/** Verifica si el pasajero ya aceptó el aviso de privacidad (RF-014). */
export function hasAcceptedPrivacyNotice(
  profile: Pick<PassengerProfile, "privacyAcceptedAt">,
): boolean {
  return profile.privacyAcceptedAt !== null;
}

/** Formatea un celular mexicano de 10 dígitos para mostrarlo en pantalla. */
export function formatMexicanPhone(phone: string | null): string {
  if (!phone) {
    return "Sin registrar";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) {
    return phone;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Obtiene hasta 2 iniciales en mayúsculas para el avatar mientras no haya foto. */
export function getProfileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "P";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
