import { DomainError } from "@/domain/shared/domain-error";

const MAX_CONCURRENT_RETRIES = 3;

export async function retryConcurrentUpdate<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_CONCURRENT_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof DomainError) || error.code !== "CONCURRENT_UPDATE") throw error;
      if (attempt === MAX_CONCURRENT_RETRIES - 1) {
        throw new DomainError(
          "CONCURRENT_UPDATE",
          "El saldo cambió varias veces. Revisa el movimiento e inténtalo de nuevo.",
        );
      }
    }
  }
  throw new DomainError("CONCURRENT_UPDATE", "No se pudo actualizar el saldo.");
}
