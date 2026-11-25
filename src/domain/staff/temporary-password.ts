import { passwordProblem } from "@/domain/auth/password-policy";

/**
 * Contraseña temporal del personal (RF-116, RF-117, RF-119). El superadministrador la ve una
 * sola vez y la cuenta queda obligada a cambiarla al entrar (RF-013).
 *
 * Sin letras ni números que se confunden al dictarla o copiarla (0/O, 1/l/I).
 */
export const TEMPORARY_PASSWORD_LENGTH = 12;

const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;

/** Entero aleatorio en [0, max). En producción es `crypto.randomInt` (seguro). */
export type RandomInt = (maxExclusive: number) => number;

export function generateTemporaryPassword(randomInt: RandomInt): string {
  const pick = (chars: string) => chars[randomInt(chars.length)];
  // Siempre al menos una letra y un número, como pide la política de contraseñas.
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < TEMPORARY_PASSWORD_LENGTH) chars.push(pick(ALPHABET));

  // Mezcla (Fisher-Yates) para que la letra y el número obligatorios no queden al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const password = chars.join("");
  const problem = passwordProblem(password);
  if (problem) throw new Error(`Contraseña temporal inválida: ${problem}`);
  return password;
}
