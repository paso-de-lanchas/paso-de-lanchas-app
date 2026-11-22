import { describe, expect, it } from "vitest";

import { createLogin } from "./login";
import type { UserCredentials } from "./ports";
import {
  fakeHasher,
  fakeTokens,
  fixedClock,
  makeUser,
  memoryAudit,
  memorySessions,
  memoryUsers,
} from "./test-doubles";

function setup(users: UserCredentials[] = [makeUser()]) {
  const sessions = memorySessions(users);
  const audit = memoryAudit();
  const login = createLogin({
    users: memoryUsers(users),
    sessions,
    hasher: fakeHasher,
    tokens: fakeTokens(),
    audit,
    clock: fixedClock("2026-11-22T12:00:00Z"),
  });
  return { login, sessions, audit };
}

describe("iniciar sesión", () => {
  it("crea la sesión guardando solo el hash del token y lleva a la sección del rol", async () => {
    const { login, sessions, audit } = setup();
    const result = await login({ email: "  Pasajero@PasoLanchas.test ", password: "secreta-123" });

    expect(result.token).toBe("token-1");
    expect(result.redirectTo).toBe("/pasajero");
    expect(result.user).toEqual({
      id: "u-1",
      email: "pasajero@pasolanchas.test",
      fullName: "Pasajero de prueba",
      role: "PASSENGER",
      mustChangePassword: false,
    });
    expect([...sessions.rows.keys()]).toEqual(["sha256:token-1"]);
    expect(result.expiresAt.toISOString()).toBe("2026-12-22T12:00:00.000Z");
    expect(audit.entries.map((e) => e.action)).toEqual(["LOGIN_SUCCEEDED"]);
  });

  it("respeta la ruta pedida solo si es de su sección", async () => {
    const admin = makeUser({ id: "a-1", email: "admin@pasolanchas.test", role: "ADMIN" });
    const { login } = setup([admin]);
    const ok = await login({ email: admin.email, password: "secreta-123", next: "/admin/tarifas" });
    const other = await login({ email: admin.email, password: "secreta-123", next: "/superadmin" });
    expect(ok.redirectTo).toBe("/admin/tarifas");
    expect(other.redirectTo).toBe("/admin");
  });

  it("da el mismo error para correo inexistente y contraseña incorrecta", async () => {
    const { login, sessions, audit } = setup();
    await expect(
      login({ email: "nadie@pasolanchas.test", password: "secreta-123" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      login({ email: "pasajero@pasolanchas.test", password: "otra" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(sessions.rows.size).toBe(0);
    expect(audit.entries.map((e) => e.details?.reason)).toEqual([
      "UNKNOWN_EMAIL",
      "WRONG_PASSWORD",
    ]);
  });

  it("rechaza datos mal formados sin consultar la base", async () => {
    const { login } = setup();
    await expect(login({ email: "no-es-correo", password: "x" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(login({ email: "pasajero@pasolanchas.test", password: "" })).rejects.toMatchObject(
      {
        code: "INVALID_CREDENTIALS",
      },
    );
  });

  it("no deja entrar a cuentas sin verificar, bloqueadas o inactivas", async () => {
    const pending = makeUser({
      id: "p",
      email: "p@pasolanchas.test",
      status: "PENDING_VERIFICATION",
    });
    const blocked = makeUser({ id: "b", email: "b@pasolanchas.test", status: "BLOCKED" });
    const inactive = makeUser({ id: "i", email: "i@pasolanchas.test", status: "INACTIVE" });
    const { login, sessions } = setup([pending, blocked, inactive]);

    await expect(login({ email: pending.email, password: "secreta-123" })).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    for (const user of [blocked, inactive]) {
      await expect(login({ email: user.email, password: "secreta-123" })).rejects.toMatchObject({
        code: "ACCOUNT_DISABLED",
      });
    }
    expect(sessions.rows.size).toBe(0);
  });
});
