import type { PassengerProfile } from "@/domain/account/passenger-profile";
import { DomainError } from "@/domain/shared/domain-error";

import type { AccountRepository } from "./account-repository";
import { updateProfileSchema } from "./profile-input";

export async function updateProfile(
  repo: AccountRepository,
  userId: string,
  rawInput: unknown,
): Promise<PassengerProfile> {
  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message ?? "Los datos del perfil no son válidos.";
    throw new DomainError("INVALID_PROFILE_INPUT", firstMessage);
  }

  const existing = await repo.findById(userId);
  if (!existing) {
    throw new DomainError("USER_NOT_FOUND", "No se encontró la cuenta del pasajero.");
  }

  return repo.updateProfile(userId, parsed.data);
}
