import { generate } from "otplib";
import { describe, expect, it } from "vitest";

import { codeForTimeStep, newSecret } from "./totp";

describe("codeForTimeStep", () => {
  const secret = newSecret();

  it("da el mismo código para el mismo paso y uno distinto para otro", async () => {
    const a = await codeForTimeStep(secret, 1000, 30);
    expect(await codeForTimeStep(secret, 1000, 30)).toBe(a);
    expect(await codeForTimeStep(secret, 1001, 30)).not.toBe(a);
  });

  it("devuelve 6 dígitos", async () => {
    expect(await codeForTimeStep(secret, 1000, 30)).toMatch(/^\d{6}$/);
  });

  it("coincide con el código que otplib da para la hora actual", async () => {
    const step = Math.floor(Date.now() / 1000 / 30);
    expect(await codeForTimeStep(secret, step, 30)).toBe(await generate({ secret, period: 30 }));
  });
});
