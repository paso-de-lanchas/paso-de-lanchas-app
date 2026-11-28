import { env } from "@/lib/env";

/** Clave para cifrar los secretos TOTP. Falla con un mensaje claro si no está configurada. */
export function getQrSigningSecret(): string {
  const secret = env.QR_SIGNING_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno QR_SIGNING_SECRET.");
  }
  return secret;
}
