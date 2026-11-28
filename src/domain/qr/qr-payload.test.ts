import { describe, expect, it } from "vitest";

import { buildQrPayload, parseQrPayload, timeStepAt } from "./qr-payload";

describe("qr-payload", () => {
  it("ida y vuelta: parse(build(x)) devuelve x", () => {
    const original = { credentialId: "a1b2-c3", code: "012345" };
    expect(parseQrPayload(buildQrPayload(original))).toEqual(original);
  });

  it("tolera espacios alrededor", () => {
    expect(parseQrPayload(" PL1.abc.123456 ")).toEqual({ credentialId: "abc", code: "123456" });
  });

  it.each([
    ["vacío", ""],
    ["otro prefijo", "PL2.abc.123456"],
    ["código de 5 dígitos", "PL1.abc.12345"],
    ["código de 7 dígitos", "PL1.abc.1234567"],
    ["código con letras", "PL1.abc.12345a"],
    ["una parte de más", "PL1.abc.123456.extra"],
    ["una parte de menos", "PL1.123456"],
  ])("rechaza %s", (_nombre, texto) => {
    expect(parseQrPayload(texto)).toBeNull();
  });
});

describe("timeStepAt", () => {
  it("cuenta ventanas desde 1970", () => {
    expect(timeStepAt(1_700_000_010_000, 30)).toBe(56_666_667);
  });

  it("cambia justo en el límite de la ventana", () => {
    const start = 56_666_667 * 30 * 1000;
    expect(timeStepAt(start - 1, 30)).toBe(56_666_666);
    expect(timeStepAt(start, 30)).toBe(56_666_667);
  });
});
