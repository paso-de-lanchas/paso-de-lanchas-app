import { describe, expect, it } from "vitest";

import { formatTripDate } from "./format-trip-date";

describe("formatTripDate", () => {
  it("formatea una fecha UTC fija en la zona horaria de America/Mexico_City", () => {
    // 16:00 UTC equivale a las 10:00 a. m. en Ciudad de México (UTC-6)
    const utcIso = "2026-11-24T16:00:00.000Z";
    const formatted = formatTripDate(utcIso);

    expect(formatted).toContain("24");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:00");
    expect(formatted).not.toContain("16:00");
  });

  it("mantiene el día anterior en México cuando en UTC ya es madrugada del día siguiente", () => {
    // 02:30 UTC del 25 de noviembre equivale a las 20:30 (8:30 p. m.) del 24 de noviembre en México
    const utcIso = "2026-11-25T02:30:00.000Z";
    const formatted = formatTripDate(utcIso);

    expect(formatted).toContain("24");
    expect(formatted).not.toContain("25");
    expect(formatted).toMatch(/20:30|8:30/);
  });
});
