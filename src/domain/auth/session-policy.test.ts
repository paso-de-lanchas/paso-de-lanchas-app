import { describe, expect, it } from "vitest";

import { isSessionExpired, sessionExpiresAt } from "./session-policy";

const now = new Date("2026-11-22T12:00:00Z");

describe("política de sesiones", () => {
  it("el pasajero tiene 30 días", () => {
    expect(sessionExpiresAt("PASSENGER", now).toISOString()).toBe("2026-12-22T12:00:00.000Z");
  });

  it("el personal tiene 12 horas", () => {
    for (const role of ["DRIVER", "ADMIN", "SUPERADMIN"] as const) {
      expect(sessionExpiresAt(role, now).toISOString()).toBe("2026-11-23T00:00:00.000Z");
    }
  });

  it("una sesión vence exactamente en su hora de expiración", () => {
    const expiresAt = new Date("2026-11-22T13:00:00Z");
    expect(isSessionExpired(expiresAt, now)).toBe(false);
    expect(isSessionExpired(expiresAt, expiresAt)).toBe(true);
  });
});
