import { describe, expect, it } from "vitest";

import { passwordProblem } from "@/domain/auth/password-policy";

import {
  hasLoginLockout,
  isStaffRole,
  nextStaffStatus,
  staffDockFor,
  statusChangeAllowedFrom,
} from "./staff-rules";
import { generateTemporaryPassword, TEMPORARY_PASSWORD_LENGTH } from "./temporary-password";

describe("contraseña temporal", () => {
  it("tiene 12 caracteres y cumple la política de contraseñas", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword((max) => Math.floor(Math.random() * max));
      expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(passwordProblem(password)).toBeNull();
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it("aunque el azar siempre dé 0, lleva una letra y un número", () => {
    const password = generateTemporaryPassword(() => 0);
    expect(password).toMatch(/[a-zA-Z]/);
    expect(password).toMatch(/\d/);
  });
});

describe("reglas de las cuentas del personal", () => {
  it("solo administradores y choferes son cuentas del personal", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("DRIVER")).toBe(true);
    expect(isStaffRole("SUPERADMIN")).toBe(false);
    expect(isStaffRole("PASSENGER")).toBe(false);
  });

  it("el administrador necesita muelle y el chofer no lleva", () => {
    expect(staffDockFor("ADMIN", "muelle-1")).toBe("muelle-1");
    expect(() => staffDockFor("ADMIN", null)).toThrow("necesita un muelle");
    expect(staffDockFor("DRIVER", "muelle-1")).toBeNull();
  });

  it("desactiva una cuenta activa o bloqueada y reactiva una desactivada o bloqueada", () => {
    expect(nextStaffStatus("ACTIVE", "DEACTIVATE")).toBe("INACTIVE");
    expect(nextStaffStatus("BLOCKED", "DEACTIVATE")).toBe("INACTIVE");
    expect(nextStaffStatus("INACTIVE", "REACTIVATE")).toBe("ACTIVE");
    expect(nextStaffStatus("BLOCKED", "REACTIVATE")).toBe("ACTIVE");
    expect(statusChangeAllowedFrom("DEACTIVATE")).toEqual(["ACTIVE", "BLOCKED"]);
  });

  it("rechaza desactivar dos veces o reactivar una cuenta activa", () => {
    expect(() => nextStaffStatus("INACTIVE", "DEACTIVATE")).toThrow("ya está desactivada");
    expect(() => nextStaffStatus("ACTIVE", "REACTIVATE")).toThrow("ya está activa");
  });

  it("detecta el bloqueo por intentos fallidos", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    const later = new Date("2026-11-24T12:10:00Z");
    const earlier = new Date("2026-11-24T11:00:00Z");
    expect(hasLoginLockout({ failedLoginAttempts: 0, lockedUntil: null }, now)).toBe(false);
    expect(hasLoginLockout({ failedLoginAttempts: 2, lockedUntil: null }, now)).toBe(true);
    expect(hasLoginLockout({ failedLoginAttempts: 0, lockedUntil: later }, now)).toBe(true);
    expect(hasLoginLockout({ failedLoginAttempts: 0, lockedUntil: earlier }, now)).toBe(false);
  });
});
