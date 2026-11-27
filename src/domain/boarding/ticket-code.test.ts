import { describe, expect, it } from "vitest";

import { generateTicketCode, TICKET_CODE_ALPHABET } from "./ticket-code";

describe("código de boleto", () => {
  it("genera 12 caracteres sin letras ni números confusos", () => {
    const code = generateTicketCode((max) => max - 1);
    expect(code).toHaveLength(12);
    expect(code).toBe(TICKET_CODE_ALPHABET.at(-1)?.repeat(12));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  });

  it("rechaza un generador aleatorio fuera de rango", () => {
    expect(() => generateTicketCode(() => -1)).toThrow("No se pudo generar el código del boleto.");
  });
});
