import { describe, expect, it } from "vitest";

import type { AuthorizedDeviceRecord } from "./ports";
import { createGetCurrentUser, createLogout } from "./session";
import {
  fakeTokens,
  fixedClock,
  makeUser,
  memoryAudit,
  memorySessions,
  memorySettings,
} from "./test-doubles";

function setup(user = makeUser(), devices: AuthorizedDeviceRecord[] = []) {
  const clock = fixedClock("2026-11-22T12:00:00Z");
  const sessions = memorySessions([user], devices, clock);
  const tokens = fakeTokens();
  const audit = memoryAudit();
  const deps = { sessions, tokens, audit, clock, settings: memorySettings() };
  return {
    sessions,
    clock,
    audit,
    getCurrentUser: createGetCurrentUser(deps),
    logout: createLogout(deps),
    open: (expiresAt = "2026-12-01T00:00:00Z", deviceId: string | null = null) =>
      sessions.create({
        userId: user.id,
        tokenHash: "sha256:abc",
        expiresAt: new Date(expiresAt),
        deviceId,
      }),
  };
}

describe("sesión actual", () => {
  it("devuelve el usuario sin datos sensibles si la sesión es válida", async () => {
    const { open, getCurrentUser } = setup();
    await open();
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
    const { open, sessions, clock, getCurrentUser } = setup();
    await open("2026-11-22T13:00:00Z");
    clock.set("2026-11-22T13:00:00Z");
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
  });

  it("corta la sesión si la cuenta se bloqueó después de iniciar sesión", async () => {
    const { open, sessions, getCurrentUser } = setup(makeUser({ status: "BLOCKED" }));
    await open();
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
  });

  it("corta la sesión si se retira la computadora autorizada", async () => {
    const admin = makeUser({ role: "ADMIN", dockId: "coa" });
    const device: AuthorizedDeviceRecord = { id: "dev", dockId: "coa", status: "APPROVED" };
    const { open, sessions, getCurrentUser } = setup(admin, [device]);
    await open(undefined, "dev");
    expect(await getCurrentUser("abc")).not.toBeNull();

    device.status = "REVOKED";
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
  });
});

describe("inactividad del personal (RF-012)", () => {
  const admin = () => makeUser({ role: "ADMIN", dockId: "coa" });

  it("la actividad mantiene viva la sesión y se registra a lo más una vez por minuto", async () => {
    const { open, sessions, clock, getCurrentUser } = setup(admin());
    await open();
    clock.set("2026-11-22T12:00:30Z");
    await getCurrentUser("abc");
    expect(sessions.rows.get("sha256:abc")?.lastActivityAt.toISOString()).toBe(
      "2026-11-22T12:00:00.000Z",
    );
    clock.set("2026-11-22T12:29:00Z");
    expect(await getCurrentUser("abc")).not.toBeNull();
    expect(sessions.rows.get("sha256:abc")?.lastActivityAt.toISOString()).toBe(
      "2026-11-22T12:29:00.000Z",
    );
  });

  it("tras 30 minutos sin actividad la cierra y lo registra", async () => {
    const { open, sessions, clock, audit, getCurrentUser } = setup(admin());
    await open();
    clock.set("2026-11-22T12:30:00Z");
    expect(await getCurrentUser("abc")).toBeNull();
    expect(sessions.rows.size).toBe(0);
    expect(audit.entries.map((e) => e.action)).toEqual(["SESSION_EXPIRED_IDLE"]);
  });

  it("al pasajero no le aplica", async () => {
    const { open, clock, getCurrentUser } = setup();
    await open();
    clock.set("2026-11-25T12:00:00Z");
    expect(await getCurrentUser("abc")).not.toBeNull();
  });
});

describe("cerrar sesión", () => {
  it("borra la sesión y lo registra en la bitácora", async () => {
    const { open, sessions, audit, logout } = setup();
    await open();
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
