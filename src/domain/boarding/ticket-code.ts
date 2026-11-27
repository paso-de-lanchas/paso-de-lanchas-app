import { DomainError } from "@/domain/shared/domain-error";

export const TICKET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TICKET_CODE_LENGTH = 12;

export function generateTicketCode(randomIndex: (max: number) => number): string {
  return Array.from({ length: TICKET_CODE_LENGTH }, () => {
    const index = randomIndex(TICKET_CODE_ALPHABET.length);
    if (!Number.isSafeInteger(index) || index < 0 || index >= TICKET_CODE_ALPHABET.length) {
      throw new DomainError(
        "INVALID_TICKET_CODE_RANDOM",
        "No se pudo generar el código del boleto.",
      );
    }
    return TICKET_CODE_ALPHABET[index];
  }).join("");
}
