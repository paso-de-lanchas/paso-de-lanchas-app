import { describe, expect, it } from "vitest";

import {
  hasIdleTimeout,
  isIdleExpired,
  isSessionExpired,
  sessionExpiresAt,
  shouldRecordActivity,
} from "./session-policy";

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

describe("inactividad del personal", () => {
  it("solo aplica al administrador y al superadministrador", () => {
    expect(hasIdleTimeout("PASSENGER")).toBe(false);
    expect(hasIdleTimeout("DRIVER")).toBe(false);
    expect(hasIdleTimeout("ADMIN")).toBe(true);
    expect(hasIdleTimeout("SUPERADMIN")).toBe(true);
  });

  it("vence al cumplirse los minutos sin actividad", () => {
    const last = new Date("2026-11-22T11:30:01Z");
    expect(isIdleExpired(last, now, 30)).toBe(false);
    expect(isIdleExpired(new Date("2026-11-22T11:30:00Z"), now, 30)).toBe(true);
  });

  it("registra la actividad a lo más una vez por minuto", () => {
    expect(shouldRecordActivity(new Date("2026-11-22T11:59:30Z"), now)).toBe(false);
    expect(shouldRecordActivity(new Date("2026-11-22T11:59:00Z"), now)).toBe(true);
  });
});
