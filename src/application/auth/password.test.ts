import { describe, expect, it } from "vitest";

import { InputError } from "../shared/input-error";
import { createChangePassword } from "./change-password";
import { createRequestPasswordReset } from "./request-password-reset";
import { createResetPassword } from "./reset-password";
import {
  fakeHasher,
  fakeTokens,
  fixedClock,
  memoryAccounts,
  memoryAudit,
  memoryMailer,
  type MemoryAccount,
} from "./test-doubles";

const APP_URL = "http://localhost:3000";

function account(overrides: Partial<MemoryAccount> = {}): MemoryAccount {
  return {
    id: "u-1",
    email: "ana@pasolanchas.test",
    fullName: "Ana",
    phone: null,
    passwordHash: "hash:vieja-123",
    status: "ACTIVE",
    emailVerifiedAt: new Date("2026-11-01T00:00:00Z"),
    walletBalance: "0.00",
    ...overrides,
  };
}

function setup(accountsList: MemoryAccount[] = [account()]) {
  const clock = fixedClock("2026-11-22T12:00:00Z");
  const sessions = [
    { userId: "u-1", tokenHash: "sha256:celular" },
    { userId: "u-1", tokenHash: "sha256:computadora" },
    { userId: "u-2", tokenHash: "sha256:otra-persona" },
  ];
  const store = memoryAccounts(accountsList, [], sessions);
  const mailer = memoryMailer();
  const audit = memoryAudit();
  const tokens = fakeTokens();
  const common = { passwords: store.passwords, tokens, mailer, audit, appUrl: APP_URL };
  return {
    ...store,
    clock,
    mailer,
    audit,
    request: createRequestPasswordReset({ ...common, clock }),
    reset: createResetPassword({
      ...common,
      emailTokens: store.emailTokens,
      hasher: fakeHasher,
      clock,
    }),
    change: createChangePassword({ ...common, hasher: fakeHasher }),
  };
}

/** El token en claro que viaja en el enlace del último correo. */
function tokenFromLastEmail(mailer: ReturnType<typeof memoryMailer>): string {
  const match = mailer.sent.at(-1)!.text.match(/\/recuperar\/(\S+)/);
  return decodeURIComponent(match![1]);
}

describe("pedir enlace para recuperar la contraseña (RF-005)", () => {
  it("manda un enlace de 30 minutos y guarda solo el hash", async () => {
    const { request, mailer, tokens, audit } = setup();
    await expect(request({ email: "  ANA@pasolanchas.test " })).resolves.toEqual({
      email: "ana@pasolanchas.test",
    });

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("ana@pasolanchas.test");
    expect(mailer.sent[0].text).toContain(`${APP_URL}/recuperar/token-1`);
    expect(mailer.sent[0].text).toContain("30 minutos");
    expect(tokens).toMatchObject([
      {
        purpose: "PASSWORD_RESET",
        tokenHash: "sha256:token-1",
        expiresAt: new Date("2026-11-22T12:30:00Z"),
      },
    ]);
    expect(audit.entries.map((e) => e.action)).toEqual(["PASSWORD_RESET_REQUESTED"]);
  });

  it("responde igual si el correo no existe o la cuenta no está activa, sin mandar nada", async () => {
    const { request, mailer, tokens } = setup([
      account({ id: "u-2", email: "bloqueada@pasolanchas.test", status: "BLOCKED" }),
    ]);
    await expect(request({ email: "nadie@pasolanchas.test" })).resolves.toEqual({
      email: "nadie@pasolanchas.test",
    });
    await expect(request({ email: "bloqueada@pasolanchas.test" })).resolves.toEqual({
      email: "bloqueada@pasolanchas.test",
    });
    expect(mailer.sent).toHaveLength(0);
    expect(tokens).toHaveLength(0);
  });

  it("manda como máximo 3 enlaces cada 30 minutos", async () => {
    const { request, mailer, clock } = setup();
    for (let i = 0; i < 5; i++) await request({ email: "ana@pasolanchas.test" });
    expect(mailer.sent).toHaveLength(3);

    clock.set("2026-11-22T12:31:00Z");
    await request({ email: "ana@pasolanchas.test" });
    expect(mailer.sent).toHaveLength(4);
  });

  it("rechaza un correo mal escrito", async () => {
    const { request } = setup();
    await expect(request({ email: "no-es-correo" })).rejects.toMatchObject({
      fieldErrors: { email: "Escribe un correo válido." },
    });
  });
});

describe("elegir contraseña nueva con el enlace (RF-005)", () => {
  const newPassword = { password: "nueva-2026", confirmPassword: "nueva-2026" };

  it("cambia la contraseña, gasta el enlace, cierra todas las sesiones y avisa", async () => {
    const { request, reset, accounts, sessions, mailer, audit } = setup();
    accounts[0].lockedUntil = new Date("2026-11-22T12:10:00Z");
    await request({ email: "ana@pasolanchas.test" });
    await reset(tokenFromLastEmail(mailer), newPassword);

    expect(accounts[0]).toMatchObject({ passwordHash: "hash:nueva-2026", lockedUntil: null });
    expect(sessions.map((s) => s.userId)).toEqual(["u-2"]);
    expect(mailer.sent.at(-1)!.subject).toContain("Tu contraseña cambió");
    expect(audit.entries.map((e) => e.action)).toEqual([
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_RESET",
    ]);
  });

  it("el enlace sirve una sola vez y al usarlo invalida los demás", async () => {
    const { request, reset, mailer } = setup();
    await request({ email: "ana@pasolanchas.test" });
    const first = tokenFromLastEmail(mailer);
    await request({ email: "ana@pasolanchas.test" });
    const second = tokenFromLastEmail(mailer);

    await reset(second, newPassword);
    await expect(reset(second, newPassword)).rejects.toMatchObject({ code: "LINK_USED" });
    await expect(reset(first, newPassword)).rejects.toMatchObject({ code: "LINK_USED" });
  });

  it("rechaza enlaces vencidos, inventados o vacíos", async () => {
    const { request, reset, mailer, clock } = setup();
    await request({ email: "ana@pasolanchas.test" });
    clock.set("2026-11-22T12:30:00Z");
    await expect(reset(tokenFromLastEmail(mailer), newPassword)).rejects.toMatchObject({
      code: "LINK_EXPIRED",
    });
    await expect(reset("inventado", newPassword)).rejects.toMatchObject({ code: "INVALID_LINK" });
    await expect(reset("", newPassword)).rejects.toMatchObject({ code: "INVALID_LINK" });
  });

  it("valida la contraseña nueva sin gastar el enlace", async () => {
    const { request, reset, mailer, tokens } = setup();
    await request({ email: "ana@pasolanchas.test" });
    const token = tokenFromLastEmail(mailer);

    await expect(reset(token, { password: "corta1", confirmPassword: "corta1" })).rejects.toThrow(
      InputError,
    );
    await expect(
      reset(token, { password: "nueva-2026", confirmPassword: "otra-2026" }),
    ).rejects.toMatchObject({ fieldErrors: { confirmPassword: "Las contraseñas no coinciden." } });
    expect(tokens[0].usedAt).toBeNull();
  });
});

describe("cambiar la contraseña desde la cuenta (RF-006, RF-013)", () => {
  const session = { userId: "u-1", token: "celular" };

  it("pide la actual, quita la contraseña temporal y cierra solo las otras sesiones", async () => {
    const { change, accounts, sessions, mailer, audit } = setup([
      account({ mustChangePassword: true }),
    ]);
    await change(session, {
      currentPassword: "vieja-123",
      password: "nueva-2026",
      confirmPassword: "nueva-2026",
    });

    expect(accounts[0]).toMatchObject({
      passwordHash: "hash:nueva-2026",
      mustChangePassword: false,
    });
    expect(sessions.map((s) => s.tokenHash)).toEqual(["sha256:celular", "sha256:otra-persona"]);
    expect(mailer.sent.map((m) => m.subject)).toEqual(["Tu contraseña cambió · Paso de Lanchas"]);
    expect(audit.entries.map((e) => e.action)).toEqual(["PASSWORD_CHANGED"]);
  });

  it("con la contraseña actual incorrecta no cambia nada y lo registra", async () => {
    const { change, accounts, sessions, audit } = setup();
    await expect(
      change(session, {
        currentPassword: "equivocada-1",
        password: "nueva-2026",
        confirmPassword: "nueva-2026",
      }),
    ).rejects.toMatchObject({
      fieldErrors: { currentPassword: "La contraseña actual no es correcta." },
    });
    expect(accounts[0].passwordHash).toBe("hash:vieja-123");
    expect(sessions).toHaveLength(3);
    expect(audit.entries.map((e) => e.action)).toEqual(["PASSWORD_CHANGE_FAILED"]);
  });

  it("la nueva debe ser distinta de la actual y cumplir la política", async () => {
    const { change } = setup();
    await expect(
      change(session, {
        currentPassword: "vieja-123",
        password: "vieja-123",
        confirmPassword: "vieja-123",
      }),
    ).rejects.toMatchObject({
      fieldErrors: { password: "La contraseña nueva debe ser distinta de la actual." },
    });
    await expect(
      change(session, { currentPassword: "", password: "abc", confirmPassword: "abc" }),
    ).rejects.toMatchObject({
      fieldErrors: {
        currentPassword: "Escribe tu contraseña actual.",
        password: "La contraseña debe tener al menos 8 caracteres.",
      },
    });
  });

  it("si la cuenta ya no existe pide iniciar sesión", async () => {
    const { change } = setup([]);
    await expect(
      change(session, {
        currentPassword: "vieja-123",
        password: "nueva-2026",
        confirmPassword: "nueva-2026",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
