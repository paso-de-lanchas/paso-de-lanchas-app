import { describe, expect, it } from "vitest";

import { createLogin, DeviceNotAuthorizedError } from "./login";
import type { AuthorizedDeviceRecord, UserCredentials } from "./ports";
import {
  fakeHasher,
  fakeTokens,
  fixedClock,
  makeUser,
  memoryAudit,
  memoryDevices,
  memorySessions,
  memorySettings,
  memoryUsers,
} from "./test-doubles";

type Device = AuthorizedDeviceRecord & { tokenHash: string };

function setup(users: UserCredentials[] = [makeUser()], devices: Device[] = []) {
  const clock = fixedClock("2026-11-22T12:00:00Z");
  const sessions = memorySessions(users, devices, clock);
  const deviceRepo = memoryDevices(devices);
  const audit = memoryAudit();
  const login = createLogin({
    users: memoryUsers(users),
    sessions,
    devices: deviceRepo,
    settings: memorySettings(),
    hasher: fakeHasher,
    tokens: fakeTokens(),
    audit,
    clock,
  });
  return { login, sessions, devices: deviceRepo.devices, audit, clock };
}

const PASSWORD = "secreta-123";
const coaDevice: Device = {
  id: "dev-coa",
  tokenHash: "sha256:pc-coa",
  dockId: "coa",
  status: "APPROVED",
};

describe("iniciar sesión", () => {
  it("crea la sesión guardando solo el hash del token y lleva a la sección del rol", async () => {
    const { login, sessions, audit } = setup();
    const result = await login({ email: "  Pasajero@PasoLanchas.test ", password: PASSWORD });

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
    const driver = makeUser({ id: "c-1", email: "chofer@pasolanchas.test", role: "DRIVER" });
    const { login } = setup([driver]);
    const ok = await login({ email: driver.email, password: PASSWORD, next: "/chofer/viaje" });
    const other = await login({ email: driver.email, password: PASSWORD, next: "/admin" });
    expect(ok.redirectTo).toBe("/chofer/viaje");
    expect(other.redirectTo).toBe("/chofer");
  });

  it("con contraseña temporal lleva primero a cambiarla (RF-013)", async () => {
    const driver = makeUser({ id: "c-2", role: "DRIVER", mustChangePassword: true });
    const { login } = setup([driver]);
    const result = await login({ email: driver.email, password: PASSWORD, next: "/chofer/viaje" });
    expect(result.redirectTo).toBe("/cuenta/cambiar-contrasena");
    expect(result.user.mustChangePassword).toBe(true);
  });

  it("da el mismo error para correo inexistente y contraseña incorrecta", async () => {
    const { login, sessions, audit } = setup();
    await expect(
      login({ email: "nadie@pasolanchas.test", password: PASSWORD }),
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

  it("rechaza datos mal formados", async () => {
    const { login } = setup();
    await expect(login({ email: "no-es-correo", password: "x" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(login({ email: "pasajero@pasolanchas.test", password: "" })).rejects.toMatchObject(
      { code: "INVALID_CREDENTIALS" },
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

    await expect(login({ email: pending.email, password: PASSWORD })).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    for (const user of [blocked, inactive]) {
      await expect(login({ email: user.email, password: PASSWORD })).rejects.toMatchObject({
        code: "ACCOUNT_DISABLED",
      });
    }
    expect(sessions.rows.size).toBe(0);
  });
});

describe("bloqueo por intentos fallidos (RF-010)", () => {
  const driver = () => makeUser({ id: "c-1", email: "chofer@pasolanchas.test", role: "DRIVER" });

  it("bloquea al personal 15 minutos al quinto intento fallido y lo registra", async () => {
    const user = driver();
    const { login, audit } = setup([user]);
    for (let i = 0; i < 5; i++) {
      await expect(login({ email: user.email, password: "mal" })).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    expect(user.lockedUntil?.toISOString()).toBe("2026-11-22T12:15:00.000Z");
    expect(user.failedLoginAttempts).toBe(0);
    expect(audit.entries.filter((e) => e.action === "ACCOUNT_LOCKED")).toHaveLength(1);

    // Aun con la contraseña correcta no entra mientras dure el bloqueo.
    await expect(login({ email: user.email, password: PASSWORD })).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
      message: expect.stringContaining("15 minutos"),
    });
    expect(audit.entries.at(-1)?.action).toBe("LOGIN_REJECTED_LOCKED");
  });

  it("durante el bloqueo, una contraseña incorrecta no lo alarga ni revela el bloqueo", async () => {
    const user = driver();
    user.lockedUntil = new Date("2026-11-22T12:10:00Z");
    const { login } = setup([user]);
    await expect(login({ email: user.email, password: "mal" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(user.lockedUntil.toISOString()).toBe("2026-11-22T12:10:00.000Z");
    expect(user.failedLoginAttempts).toBe(0);
  });

  it("al terminar el bloqueo puede entrar y el contador vuelve a cero", async () => {
    const user = driver();
    Object.assign(user, { lockedUntil: new Date("2026-11-22T11:59:00Z"), failedLoginAttempts: 2 });
    const { login } = setup([user]);
    await expect(login({ email: user.email, password: PASSWORD })).resolves.toBeDefined();
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
  });

  it("al pasajero no lo bloquea", async () => {
    const user = makeUser();
    const { login } = setup([user]);
    for (let i = 0; i < 6; i++) {
      await expect(login({ email: user.email, password: "mal" })).rejects.toThrow();
    }
    expect(user.lockedUntil).toBeNull();
    await expect(login({ email: user.email, password: PASSWORD })).resolves.toBeDefined();
  });
});

describe("computadoras autorizadas (RF-011)", () => {
  const admin = () =>
    makeUser({ id: "a-1", email: "admin@pasolanchas.test", role: "ADMIN", dockId: "coa" });

  it("desde una computadora nueva no entra, crea la solicitud y entrega su token", async () => {
    const { login, devices, sessions, audit } = setup([admin()]);
    const error = await login({ email: "admin@pasolanchas.test", password: PASSWORD }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DeviceNotAuthorizedError);
    expect(error).toMatchObject({ code: "DEVICE_PENDING", deviceToken: "token-1" });
    expect(devices).toEqual([
      { id: "d-1", tokenHash: "sha256:token-1", dockId: "coa", status: "PENDING" },
    ]);
    expect(sessions.rows.size).toBe(0);
    expect(audit.entries.at(-1)).toMatchObject({
      action: "DEVICE_APPROVAL_REQUESTED",
      deviceId: "d-1",
    });
  });

  it("con la computadora pendiente sigue sin entrar y no duplica la solicitud", async () => {
    const pending: Device = { ...coaDevice, status: "PENDING" };
    const { login, devices } = setup([admin()], [pending]);
    await expect(
      login({ email: "admin@pasolanchas.test", password: PASSWORD }, { deviceToken: "pc-coa" }),
    ).rejects.toMatchObject({ code: "DEVICE_PENDING", deviceToken: undefined });
    expect(devices).toHaveLength(1);
  });

  it("si la cookie trae un token que la base no conoce, lo reutiliza para la solicitud", async () => {
    const { login, devices } = setup([admin()]);
    await expect(
      login({ email: "admin@pasolanchas.test", password: PASSWORD }, { deviceToken: "viejo" }),
    ).rejects.toMatchObject({ code: "DEVICE_PENDING", deviceToken: undefined });
    expect(devices[0].tokenHash).toBe("sha256:viejo");
  });

  it("entra desde una computadora aprobada de su muelle y la sesión la recuerda", async () => {
    const { login, sessions } = setup([admin()], [coaDevice]);
    const result = await login(
      { email: "admin@pasolanchas.test", password: PASSWORD },
      { deviceToken: "pc-coa" },
    );
    expect(result.redirectTo).toBe("/admin");
    expect(sessions.rows.get("sha256:token-1")?.deviceId).toBe("dev-coa");
  });

  it("rechaza computadoras revocadas o de otro muelle y lo registra", async () => {
    const revoked: Device = { ...coaDevice, status: "REVOKED" };
    const otherDock: Device = {
      id: "dev-val",
      tokenHash: "sha256:pc-val",
      dockId: "val",
      status: "APPROVED",
    };
    const { login, audit } = setup([admin()], [revoked, otherDock]);

    await expect(
      login({ email: "admin@pasolanchas.test", password: PASSWORD }, { deviceToken: "pc-coa" }),
    ).rejects.toMatchObject({ code: "DEVICE_REVOKED" });
    await expect(
      login({ email: "admin@pasolanchas.test", password: PASSWORD }, { deviceToken: "pc-val" }),
    ).rejects.toMatchObject({ code: "DEVICE_WRONG_DOCK" });
    expect(audit.entries.map((e) => [e.action, e.details?.reason])).toEqual([
      ["LOGIN_REJECTED_DEVICE", "REVOKED"],
      ["LOGIN_REJECTED_DEVICE", "WRONG_DOCK"],
    ]);
  });

  it("el superadministrador entra desde cualquier computadora aprobada", async () => {
    const superadmin = makeUser({ id: "s-1", email: "super@pasolanchas.test", role: "SUPERADMIN" });
    const otherDock: Device = {
      id: "dev-val",
      tokenHash: "sha256:pc-val",
      dockId: "val",
      status: "APPROVED",
    };
    const { login } = setup([superadmin], [otherDock]);
    await expect(
      login({ email: superadmin.email, password: PASSWORD }, { deviceToken: "pc-val" }),
    ).resolves.toMatchObject({ redirectTo: "/superadmin" });
  });

  it("al chofer y al pasajero no les pide computadora autorizada", async () => {
    const driver = makeUser({ id: "c-1", email: "chofer@pasolanchas.test", role: "DRIVER" });
    const { login, devices } = setup([driver]);
    await expect(login({ email: driver.email, password: PASSWORD })).resolves.toBeDefined();
    expect(devices).toHaveLength(0);
  });
});
