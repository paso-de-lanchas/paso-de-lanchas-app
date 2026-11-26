import { describe, expect, it } from "vitest";

import { Money } from "@/domain/shared/money";

import {
  buildAnonymizedAccountData,
  buildAnonymizedEmail,
  buildBalanceForfeitureWarning,
  DELETED_USER_FULL_NAME,
  ensureAccountCanBeCancelled,
} from "./account-cancellation";

describe("account cancellation domain rules", () => {
  const now = new Date("2026-11-22T12:00:00.000Z");

  it("construye los datos anonimizados correctamente", () => {
    const data = buildAnonymizedAccountData("user-123", "argon2-random-hash", now);

    expect(data).toEqual({
      deletedAt: now,
      status: "INACTIVE",
      fullName: DELETED_USER_FULL_NAME,
      email: buildAnonymizedEmail("user-123"),
      phone: null,
      photoUrl: null,
      passwordHash: "argon2-random-hash",
    });
    expect(data.email).toBe("eliminado-user-123@pasolanchas.invalid");
  });

  it("rechaza cancelar una cuenta que ya fue cancelada o está inactiva", () => {
    expect(() => ensureAccountCanBeCancelled({ status: "ACTIVE", deletedAt: null })).not.toThrow();

    expect(() => ensureAccountCanBeCancelled({ status: "ACTIVE", deletedAt: now })).toThrow(
      "Esta cuenta ya fue cancelada.",
    );

    expect(() => ensureAccountCanBeCancelled({ status: "INACTIVE", deletedAt: null })).toThrow(
      "Esta cuenta ya fue cancelada.",
    );
  });

  it("genera advertencia cuando el pasajero tiene saldo mayor a $0", () => {
    const withBalance = buildBalanceForfeitureWarning(Money.fromPesos(100));
    expect(withBalance.hasBalance).toBe(true);
    expect(withBalance.formattedBalance).toContain("100.00");
    expect(withBalance.message).toContain("perderás este saldo");

    const withoutBalance = buildBalanceForfeitureWarning(Money.zero());
    expect(withoutBalance.hasBalance).toBe(false);
    expect(withoutBalance.message).toBeNull();
  });
});
