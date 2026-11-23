/**
 * Enlaces de un solo uso que se mandan por correo (verificar correo, recuperar contraseña).
 */
export const EMAIL_VERIFICATION_HOURS = 24;

export function emailTokenExpiresAt(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export type EmailTokenState = "VALID" | "USED" | "EXPIRED";

export function emailTokenState(
  token: { expiresAt: Date; usedAt: Date | null },
  now: Date,
): EmailTokenState {
  if (token.usedAt) return "USED";
  return token.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "VALID";
}

/** Recuperar contraseña (RF-005): el enlace dura 30 minutos. */
export const PASSWORD_RESET_MINUTES = 30;
/** Máximo de enlaces de recuperación por cuenta en esa ventana (evita llenar su buzón). */
export const MAX_PASSWORD_RESETS_PER_WINDOW = 3;

export function minutesAfter(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60 * 1000);
}
