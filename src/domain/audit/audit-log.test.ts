import { describe, expect, it } from "vitest";

import {
  auditActionLabel,
  mexicoDateRange,
  redactAuditDetails,
  startOfMexicoDay,
} from "./audit-log";

describe("fechas de la bitácora en hora de México", () => {
  it("el día empieza a las 00:00 de México (06:00 UTC)", () => {
    expect(startOfMexicoDay("2026-11-27")?.toISOString()).toBe("2026-11-27T06:00:00.000Z");
  });

  it("rechaza fechas imposibles o mal escritas", () => {
    expect(startOfMexicoDay("2026-02-31")).toBeNull();
    expect(startOfMexicoDay("2026-13-01")).toBeNull();
    expect(startOfMexicoDay("27/11/2026")).toBeNull();
    expect(startOfMexicoDay("")).toBeNull();
  });

  it("'hasta' incluye todo su día (límite exclusivo al día siguiente)", () => {
    const range = mexicoDateRange("2026-11-27", "2026-11-27");
    expect(range.from?.toISOString()).toBe("2026-11-27T06:00:00.000Z");
    expect(range.toExclusive?.toISOString()).toBe("2026-11-28T06:00:00.000Z");
    // 23:59 del 27 en México todavía entra; 00:00 del 28 ya no.
    const lateNight = new Date("2026-11-28T05:59:00.000Z");
    expect(lateNight < range.toExclusive!).toBe(true);
  });

  it("sin fechas no limita", () => {
    expect(mexicoDateRange(undefined, undefined)).toEqual({});
    expect(mexicoDateRange("2026-02-31", undefined)).toEqual({});
  });
});

describe("detalle de la bitácora", () => {
  it("oculta contraseñas, tokens y secretos en cualquier nivel", () => {
    const redacted = redactAuditDetails({
      amountCents: 1000,
      password: "x",
      nested: { passwordHash: "h", sessionToken: "t", ok: true, list: [{ qrSecret: "s" }] },
      AUTHORIZATION: "Bearer y",
    });
    expect(redacted).toEqual({
      amountCents: 1000,
      password: "[oculto]",
      nested: {
        passwordHash: "[oculto]",
        sessionToken: "[oculto]",
        ok: true,
        list: [{ qrSecret: "[oculto]" }],
      },
      AUTHORIZATION: "[oculto]",
    });
  });

  it("deja igual los valores simples y corta estructuras demasiado profundas", () => {
    expect(redactAuditDetails(null)).toBeNull();
    expect(redactAuditDetails("texto")).toBe("texto");
    expect(redactAuditDetails({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toEqual({
      a: { b: { c: { d: { e: "[…]" } } } },
    });
  });

  it("traduce las acciones conocidas y deja igual las nuevas", () => {
    expect(auditActionLabel("WALLET_TOPUP_CASH")).toBe("Recarga en efectivo");
    expect(auditActionLabel("ALGO_NUEVO")).toBe("ALGO_NUEVO");
  });
});
