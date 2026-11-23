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
