"use server";

import { DomainError } from "@/domain/shared/domain-error";
import { verifyEmail } from "@/lib/auth/auth";

export interface VerifyState {
  verified?: boolean;
  error?: string;
}

/** Botón "Confirmar mi correo" (RF-002). */
export async function verifyEmailAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  try {
    await verifyEmail(String(formData.get("token") ?? ""));
    return { verified: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
