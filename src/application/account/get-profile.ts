import type { PassengerProfile } from "@/domain/account/passenger-profile";
import { DomainError } from "@/domain/shared/domain-error";

import type { AccountRepository } from "./account-repository";

export async function getProfileById(
  repo: AccountRepository,
  userId: string,
): Promise<PassengerProfile> {
  const profile = await repo.findById(userId);
  if (!profile) {
    throw new DomainError("USER_NOT_FOUND", "No se encontró la cuenta del pasajero.");
  }
  return profile;
}

export async function getProfileByEmail(
  repo: AccountRepository,
  email: string,
): Promise<PassengerProfile> {
  const profile = await repo.findByEmail(email);
  if (!profile) {
    throw new DomainError("USER_NOT_FOUND", "No se encontró la cuenta del pasajero.");
  }
  return profile;
}
