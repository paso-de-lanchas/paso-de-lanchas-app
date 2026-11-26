import { describe, expect, it } from "vitest";

import {
  formatMexicanPhone,
  getProfileInitials,
  hasAcceptedPrivacyNotice,
} from "./passenger-profile";

describe("passenger-profile domain rules", () => {
  it("detecta si el aviso de privacidad fue aceptado", () => {
    expect(hasAcceptedPrivacyNotice({ privacyAcceptedAt: new Date("2026-11-19T10:00:00Z") })).toBe(
      true,
    );
    expect(hasAcceptedPrivacyNotice({ privacyAcceptedAt: null })).toBe(false);
  });

  it("formatea celulares de 10 dígitos y maneja valores vacíos", () => {
    expect(formatMexicanPhone("9211234567")).toBe("921 123 4567");
    expect(formatMexicanPhone(null)).toBe("Sin registrar");
    expect(formatMexicanPhone("12345")).toBe("12345");
  });

  it("calcula iniciales del nombre completo", () => {
    expect(getProfileInitials("Pasajera de prueba")).toBe("PP");
    expect(getProfileInitials("José")).toBe("J");
    expect(getProfileInitials("   ")).toBe("P");
  });
});
