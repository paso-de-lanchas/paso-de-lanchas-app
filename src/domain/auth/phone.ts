/**
 * Celular de México: 10 dígitos. Acepta espacios, guiones, paréntesis y el prefijo +52;
 * devuelve solo los 10 dígitos, o null si no es válido.
 */
export function normalizeMexicanPhone(phone: string): string | null {
  const digits = phone.replace(/[\s\-().]/g, "").replace(/^\+?52(?=\d{10}$)/, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}
