/** Correo normalizado: sin espacios y en minúsculas, para que " Ana@X.com" y "ana@x.com" sean la misma cuenta. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
