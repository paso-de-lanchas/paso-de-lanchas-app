import { describe, expect, it } from "vitest";

import type { PassengerProfile } from "@/domain/account/passenger-profile";
import { DomainError } from "@/domain/shared/domain-error";

import type { AccountRepository, UpdateProfileData } from "./account-repository";
import { getProfileByEmail, getProfileById } from "./get-profile";
import { updateProfile } from "./update-profile";

class InMemoryAccountRepository implements AccountRepository {
  private readonly users = new Map<string, PassengerProfile>();

  constructor(initialUsers: PassengerProfile[]) {
    for (const user of initialUsers) {
      this.users.set(user.id, { ...user });
    }
  }

  async findById(userId: string): Promise<PassengerProfile | null> {
    return this.users.get(userId) ?? null;
  }

  async findByEmail(email: string): Promise<PassengerProfile | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<PassengerProfile> {
    const current = this.users.get(userId);
    if (!current) {
      throw new Error("Usuario inexistente en repositorio en memoria");
    }
    const updated: PassengerProfile = {
      ...current,
      fullName: data.fullName,
      phone: data.phone,
    };
    this.users.set(userId, updated);
    return updated;
  }
}

const seedPassenger: PassengerProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "pasajero@pasolanchas.test",
  fullName: "Pasajera de prueba",
  phone: null,
  photoUrl: null,
  privacyAcceptedAt: new Date("2026-11-18T12:00:00Z"),
};

describe("account use cases", () => {
  it("obtiene el perfil por id o por correo", async () => {
    const repo = new InMemoryAccountRepository([seedPassenger]);

    const byId = await getProfileById(repo, seedPassenger.id);
    const byEmail = await getProfileByEmail(repo, seedPassenger.email);

    expect(byId.fullName).toBe("Pasajera de prueba");
    expect(byEmail.id).toBe(seedPassenger.id);
  });

  it("lanza USER_NOT_FOUND cuando el pasajero no existe", async () => {
    const repo = new InMemoryAccountRepository([]);

    await expect(getProfileById(repo, "no-existe")).rejects.toThrowError(DomainError);
    await expect(getProfileByEmail(repo, "nadie@pasolanchas.test")).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });
  });

  it("actualiza nombre y celular válido de 10 dígitos", async () => {
    const repo = new InMemoryAccountRepository([seedPassenger]);

    const updated = await updateProfile(repo, seedPassenger.id, {
      fullName: "  María Fernanda López  ",
      phone: "9211234567",
    });

    expect(updated.fullName).toBe("María Fernanda López");
    expect(updated.phone).toBe("9211234567");
    expect(updated.email).toBe("pasajero@pasolanchas.test");
  });

  it("permite limpiar el celular enviando cadena vacía", async () => {
    const repo = new InMemoryAccountRepository([{ ...seedPassenger, phone: "9211234567" }]);

    const updated = await updateProfile(repo, seedPassenger.id, {
      fullName: "Pasajera de prueba",
      phone: "   ",
    });

    expect(updated.phone).toBeNull();
  });

  it("rechaza nombre vacío o celular que no tenga 10 dígitos", async () => {
    const repo = new InMemoryAccountRepository([seedPassenger]);

    await expect(
      updateProfile(repo, seedPassenger.id, { fullName: "   ", phone: "9211234567" }),
    ).rejects.toMatchObject({ code: "INVALID_PROFILE_INPUT" });

    await expect(
      updateProfile(repo, seedPassenger.id, { fullName: "Ana Pérez", phone: "921123" }),
    ).rejects.toMatchObject({ code: "INVALID_PROFILE_INPUT" });

    await expect(
      updateProfile(repo, seedPassenger.id, { fullName: "Ana Pérez", phone: "92112abc67" }),
    ).rejects.toMatchObject({ code: "INVALID_PROFILE_INPUT" });
  });

  it("lanza USER_NOT_FOUND al intentar actualizar un usuario inexistente", async () => {
    const repo = new InMemoryAccountRepository([]);

    await expect(
      updateProfile(repo, "id-inexistente", { fullName: "Ana Pérez", phone: "" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });
});
