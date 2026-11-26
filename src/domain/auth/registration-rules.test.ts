import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email";
import {
  emailTokenExpiresAt,
  emailTokenState,
  minutesAfter,
  PASSWORD_RESET_MINUTES,
} from "./email-token";
import { passwordProblem } from "./password-policy";
import { normalizeMexicanPhone } from "./phone";

describe("correo", () => {
  it("quita espacios y pasa a minúsculas", () => {
    expect(normalizeEmail("  Ana.Perez@Correo.MX ")).toBe("ana.perez@correo.mx");
  });
});

describe("política de contraseñas", () => {
  it("acepta 8 o más caracteres con letra y número", () => {
    expect(passwordProblem("lancha2026")).toBeNull();
    expect(passwordProblem("ñandú123")).toBeNull();
  });

  it("explica qué falta", () => {
    expect(passwordProblem("abc12")).toMatch(/al menos 8/);
    expect(passwordProblem("solamenteletras")).toMatch(/una letra y un número/);
    expect(passwordProblem("12345678")).toMatch(/una letra y un número/);
    expect(passwordProblem(`a1${"x".repeat(127)}`)).toMatch(/como máximo 128/);
  });
});

describe("celular", () => {
  it("normaliza a 10 dígitos", () => {
    expect(normalizeMexicanPhone("921 123 4567")).toBe("9211234567");
    expect(normalizeMexicanPhone("+52 (921) 123-45-67")).toBe("9211234567");
    expect(normalizeMexicanPhone("529211234567")).toBe("9211234567");
  });

  it("rechaza lo que no es un celular de 10 dígitos", () => {
    expect(normalizeMexicanPhone("12345")).toBeNull();
    expect(normalizeMexicanPhone("92112345678")).toBeNull();
    expect(normalizeMexicanPhone("921-ABC-4567")).toBeNull();
  });
});

describe("enlaces por correo", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  it("vence a las horas indicadas", () => {
    expect(emailTokenExpiresAt(now, 24).toISOString()).toBe("2026-11-23T12:00:00.000Z");
  });

  it("el de recuperar contraseña vence a los 30 minutos", () => {
    expect(minutesAfter(now, PASSWORD_RESET_MINUTES).toISOString()).toBe(
      "2026-11-22T12:30:00.000Z",
    );
  });

  it("es válido solo si no se usó y no ha vencido", () => {
    const expiresAt = new Date("2026-11-23T12:00:00Z");
    expect(emailTokenState({ expiresAt, usedAt: null }, now)).toBe("VALID");
    expect(emailTokenState({ expiresAt, usedAt: now }, now)).toBe("USED");
    expect(emailTokenState({ expiresAt: now, usedAt: null }, now)).toBe("EXPIRED");
  });
});
