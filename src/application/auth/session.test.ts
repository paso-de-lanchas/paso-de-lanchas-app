import { describe, expect, it } from "vitest";

import { createGetCurrentUser, createLogout } from "./session";
import { fakeTokens, fixedClock, makeUser, memoryAudit, memorySessions } from "./test-doubles";

function setup(user = makeUser()) {
  const sessions = memorySessions([user]);
  const tokens = fakeTokens();
  const clock = fixedClock("2026-11-22T12:00:00Z");
  const audit = memoryAudit();
  return {
    sessions,
    clock,
    audit,
    getCurrentUser: createGetCurrentUser({ sessions, tokens, clock }),
    logout: createLogout({ sessions, tokens, audit }),
  };
}

describe("sesión actual", () => {
  it("devuelve el usuario sin datos sensibles si la sesión es válida", async () => {
    const { sessions, getCurrentUser } = setup();
    await sessions.create({
      userId: "u-1",
      tokenHash: "sha256:abc",
      expiresAt: new Date("2026-11-23T00:00:00Z"),
    });

    const user = await getCurrentUser("abc");
    expect(user).toEqual({
      id: "u-1",
      email: "pasajero@pasolanchas.test",
      fullName: "Pasajero de prueba",
      role: "PASSENGER",
      mustChangePassword: false,
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("status");
  });

  it("devuelve null sin cookie o con un token desconocido", async () => {
    const { getCurrentUser } = setup();
    expect(await getCurrentUser(undefined)).toBeNull();
    expect(await getCurrentUser("inventado")).toBeNull();
  });

  it("borra la sesión vencida", async () => {
    const { sessions, clock, getCurrentUser } = setup();
    await sessions.create({
      userId: "u-1",
      tokenHash: "sha256:abc",
      expiresAt: new Date("2026-11-22T13:00:00Z"),
    });
    clock.set("2026-11-22T13:00:00Z");
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
  });

  it("corta la sesión si la cuenta se bloqueó después de iniciar sesión", async () => {
    const { sessions, getCurrentUser } = setup(makeUser({ status: "BLOCKED" }));
    await sessions.create({
      userId: "u-1",
      tokenHash: "sha256:abc",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
  });
});

describe("cerrar sesión", () => {
  it("borra la sesión y lo registra en la bitácora", async () => {
    const { sessions, audit, logout } = setup();
    await sessions.create({
      userId: "u-1",
      tokenHash: "sha256:abc",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });
    await logout("abc");
    expect(sessions.rows.size).toBe(0);
    expect(audit.entries).toEqual([
      { userId: "u-1", action: "LOGOUT", entity: "user", entityId: "u-1" },
    ]);
  });

  it("no falla si no había sesión", async () => {
    const { audit, logout } = setup();
    await logout(undefined);
    await logout("inexistente");
    expect(audit.entries).toEqual([]);
  });
});
