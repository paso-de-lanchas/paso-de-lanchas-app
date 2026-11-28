import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./secret-cipher";

const KEY = "clave-de-prueba-larga-y-aleatoria";
const OTHER_KEY = "otra-clave-de-prueba-distinta";
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY";

describe("secret-cipher", () => {
  it("descifra lo que cifró", () => {
    const stored = encryptSecret(SECRET, KEY);
    expect(decryptSecret(stored, KEY)).toBe(SECRET);
  });

  it("no deja el secreto en claro en el texto cifrado", () => {
    const stored = encryptSecret(SECRET, KEY);
    expect(stored).not.toContain(SECRET);
  });

  it("cifrar dos veces el mismo texto da resultados distintos (IV aleatorio)", () => {
    expect(encryptSecret(SECRET, KEY)).not.toBe(encryptSecret(SECRET, KEY));
  });

  it("falla al descifrar con otra clave", () => {
    const stored = encryptSecret(SECRET, KEY);
    expect(() => decryptSecret(stored, OTHER_KEY)).toThrow();
  });

  it("falla si el texto cifrado fue alterado", () => {
    const stored = encryptSecret(SECRET, KEY);
    const [iv, tag, data] = stored.split(".");
    // Cambia el primer carácter de los datos cifrados por otro distinto.
    const tampered = (data[0] === "A" ? "B" : "A") + data.slice(1);
    expect(() => decryptSecret([iv, tag, tampered].join("."), KEY)).toThrow();
  });
});
