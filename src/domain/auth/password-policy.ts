/**
 * Reglas de contraseña: de 8 a 128 caracteres, con al menos una letra y un número.
 * Devuelve el problema en español, o null si la contraseña es válida.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña puede tener como máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    return "La contraseña debe tener al menos una letra y un número.";
  }
  return null;
}
