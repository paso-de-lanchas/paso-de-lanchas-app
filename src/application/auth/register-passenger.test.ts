import { describe, expect, it } from "vitest";

import { escapeHtml } from "./emails";
import { createRegisterPassenger, RegistrationInputError } from "./register-passenger";
import { createVerifyEmail } from "./verify-email";
import {
  fakeHasher,
  fakeTokens,
  fixedClock,
  memoryAccounts,
  memoryAudit,
  memoryMailer,
  type MemoryAccount,
} from "./test-doubles";

function setup(accounts: MemoryAccount[] = []) {
  const store = memoryAccounts(accounts);
  const mailer = memoryMailer();
  const audit = memoryAudit();
  const clock = fixedClock("2026-11-22T12:00:00Z");
  const tokens = fakeTokens();
  const register = createRegisterPassenger({
    accounts: store.registration,
    hasher: fakeHasher,
    tokens,
    mailer,
    audit,
    clock,
    appUrl: "http://localhost:3000",
  });
  const verify = createVerifyEmail({ emailTokens: store.emailTokens, tokens, audit, clock });
  return { ...store, mailer, audit, clock, register, verify };
}

const valid = {
  fullName: "  Ana Pérez ",
  email: " Ana@Correo.MX ",
  phone: "921 123 4567",
  password: "lancha2026",
  acceptPrivacy: true,
};

const existing = (overrides: Partial<MemoryAccount> = {}): MemoryAccount => ({
  id: "u-9",
  email: "ana@correo.mx",
  fullName: "Ana Registrada",
  phone: "9210000000",
  passwordHash: "hash:original1",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
  walletBalance: "50.00",
  ...overrides,
});

describe("registro de pasajero", () => {
  it("crea la cuenta pendiente con monedero en $0 y manda el enlace de verificación", async () => {
    const { register, accounts, tokens, mailer, audit } = setup();
    await expect(register(valid)).resolves.toEqual({ email: "ana@correo.mx" });

    expect(accounts).toEqual([
      {
        id: "u-1",
        email: "ana@correo.mx",
        fullName: "Ana Pérez",
        phone: "9211234567",
        passwordHash: "hash:lancha2026",
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
        walletBalance: "0.00",
      },
    ]);
    // En la base solo queda el hash del token; el token en claro solo viaja en el correo.
    expect(tokens).toMatchObject([
      {
        userId: "u-1",
        purpose: "EMAIL_VERIFICATION",
        tokenHash: "sha256:token-1",
        expiresAt: new Date("2026-11-23T12:00:00Z"),
      },
    ]);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("ana@correo.mx");
    expect(mailer.sent[0].text).toContain("http://localhost:3000/verificar-correo?token=token-1");
    expect(mailer.sent[0].text).not.toContain("lancha2026");
    expect(audit.entries.map((e) => e.action)).toEqual(["USER_REGISTERED"]);
  });

  it("devuelve un error por campo cuando los datos no son válidos", async () => {
    const { register, accounts, mailer } = setup();
    const error = await register({
      fullName: "A",
      email: "no-es-correo",
      phone: "123",
      password: "corta",
      acceptPrivacy: false,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RegistrationInputError);
    expect((error as RegistrationInputError).fieldErrors).toEqual({
      fullName: "Escribe tu nombre completo.",
      email: "Escribe un correo válido.",
      phone: "Escribe tu celular a 10 dígitos.",
      password: "La contraseña debe tener al menos 8 caracteres.",
      acceptPrivacy: "Debes aceptar el aviso de privacidad para crear tu cuenta.",
    });
    expect(accounts).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it("con un correo ya activo responde igual, no cambia la cuenta y avisa a su dueño", async () => {
    const owner = existing();
    const { register, accounts, tokens, mailer } = setup([owner]);
    await expect(register(valid)).resolves.toEqual({ email: "ana@correo.mx" });

    expect(accounts).toEqual([existing()]);
    expect(tokens).toHaveLength(0);
    expect(mailer.sent.map((m) => m.subject)).toEqual(["Ya tienes una cuenta · Paso de Lanchas"]);
  });

  it("con un correo pendiente de confirmar manda un enlace nuevo sin cambiar sus datos", async () => {
    const pending = existing({ status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    const { register, accounts, tokens, mailer } = setup([pending]);
    await register(valid);

    expect(accounts[0].passwordHash).toBe("hash:original1");
    expect(tokens).toMatchObject([{ userId: "u-9", purpose: "EMAIL_VERIFICATION" }]);
    expect(mailer.sent[0].subject).toBe("Confirma tu correo · Paso de Lanchas");
  });

  it("escapa el nombre en el HTML del correo", async () => {
    const { register, mailer } = setup();
    await register({ ...valid, fullName: "<script>alert(1)</script>" });
    expect(mailer.sent[0].html).toContain(escapeHtml("<script>alert(1)</script>"));
    expect(mailer.sent[0].html).not.toContain("<script>");
  });
});

describe("verificación del correo", () => {
  it("activa la cuenta y el enlace ya no sirve una segunda vez", async () => {
    const { register, verify, accounts, audit } = setup();
    await register(valid);

    await verify("token-1");
    expect(accounts[0]).toMatchObject({
      status: "ACTIVE",
      emailVerifiedAt: new Date("2026-11-22T12:00:00Z"),
    });
    expect(audit.entries.at(-1)?.action).toBe("EMAIL_VERIFIED");
    await expect(verify("token-1")).rejects.toMatchObject({ code: "LINK_USED" });
  });

  it("rechaza enlaces vencidos o inventados", async () => {
    const { register, verify, accounts, clock } = setup();
    await register(valid);
    clock.set("2026-11-23T12:00:00Z");

    await expect(verify("token-1")).rejects.toMatchObject({ code: "LINK_EXPIRED" });
    await expect(verify("inventado")).rejects.toMatchObject({ code: "INVALID_LINK" });
    await expect(verify("")).rejects.toMatchObject({ code: "INVALID_LINK" });
    expect(accounts[0].status).toBe("PENDING_VERIFICATION");
  });
});
