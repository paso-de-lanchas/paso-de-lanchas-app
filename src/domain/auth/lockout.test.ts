import { describe, expect, it } from "vitest";

import { hasLockout, isLocked, lockedUntilFrom, minutesUntilUnlock, shouldLock } from "./lockout";

const now = new Date("2026-11-22T12:00:00Z");

describe("bloqueo por intentos fallidos", () => {
  it("aplica al personal y no al pasajero", () => {
    expect(hasLockout("PASSENGER")).toBe(false);
    expect(hasLockout("DRIVER")).toBe(true);
    expect(hasLockout("ADMIN")).toBe(true);
    expect(hasLockout("SUPERADMIN")).toBe(true);
  });

  it("se bloquea al llegar al máximo de intentos", () => {
    expect(shouldLock(4, 5)).toBe(false);
    expect(shouldLock(5, 5)).toBe(true);
  });

  it("el bloqueo dura los minutos indicados y termina a la hora exacta", () => {
    const until = lockedUntilFrom(now, 15);
    expect(until.toISOString()).toBe("2026-11-22T12:15:00.000Z");
    expect(isLocked(until, now)).toBe(true);
    expect(isLocked(until, until)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });

  it("calcula los minutos que faltan, al menos 1", () => {
    expect(minutesUntilUnlock(new Date("2026-11-22T12:14:01Z"), now)).toBe(15);
    expect(minutesUntilUnlock(new Date("2026-11-22T12:00:10Z"), now)).toBe(1);
  });
});
