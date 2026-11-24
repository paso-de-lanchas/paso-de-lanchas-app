import { beforeEach, describe, expect, it } from "vitest";

import { fakeHasher, fixedClock, memoryAudit, memoryMailer } from "../auth/test-doubles";
import { InputError } from "../shared/input-error";
import { createCreateStaffAccount } from "./create-staff-account";
import { createGetStaffAccount, createListDocks, createListStaff } from "./list-staff";
import { createResetStaffPassword } from "./reset-staff-password";
import { createSetStaffStatus } from "./set-staff-status";
import { DOCKS, memoryStaff, memoryStaffUser, type MemoryStaffUser } from "./test-doubles";
import { createUnlockStaffAccount } from "./unlock-staff-account";

const actor = { id: "00000000-0000-4000-8000-0000000000aa" };
const APP_URL = "http://localhost:3000";

function setup(users: MemoryStaffUser[] = []) {
  const audit = memoryAudit();
  const staff = memoryStaff(users, audit);
  const mailer = memoryMailer();
  const clock = fixedClock("2026-11-24T12:00:00Z");
  let counter = 0;
  const generatePassword = () => `Temporal${++counter}xyz`;
  const deps = {
    staff,
    audit,
    mailer,
    clock,
    hasher: fakeHasher,
    generatePassword,
    appUrl: APP_URL,
  };
  return {
    ...deps,
    create: createCreateStaffAccount(deps),
    setStatus: createSetStaffStatus(deps),
    unlock: createUnlockStaffAccount(deps),
    resetPassword: createResetStaffPassword(deps),
    list: createListStaff(deps),
    get: createGetStaffAccount(deps),
    docks: createListDocks(deps),
  };
}

const newAdmin = {
  fullName: "Ana Taquillera",
  email: "  Ana.Taquilla@PasoLanchas.test ",
  phone: "921 123 4567",
  role: "ADMIN",
  dockId: DOCKS[0].id,
};

async function expectFieldError(promise: Promise<unknown>, field: string, text: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(InputError);
  expect((error as InputError).fieldErrors).toMatchObject({
    [field]: expect.stringContaining(text),
  });
}

describe("crear cuenta del personal (RF-116, RF-117)", () => {
  it("crea un administrador activo con muelle, contraseña temporal y correo", async () => {
    const s = setup();
    const result = await s.create(actor, newAdmin);

    expect(result.temporaryPassword).toBe("Temporal1xyz");
    expect(result.emailSent).toBe(true);
    const user = s.staff.users[0];
    expect(user).toMatchObject({
      email: "ana.taquilla@pasolanchas.test",
      phone: "9211234567",
      role: "ADMIN",
      dockId: DOCKS[0].id,
      status: "ACTIVE",
      mustChangePassword: true,
      passwordHash: "hash:Temporal1xyz",
    });

    expect(s.mailer.sent[0].to).toBe("ana.taquilla@pasolanchas.test");
    expect(s.mailer.sent[0].text).toContain("Temporal1xyz");
    expect(s.mailer.sent[0].text).toContain("administrador");
    expect(s.audit.entries).toEqual([
      expect.objectContaining({
        userId: actor.id,
        action: "STAFF_ACCOUNT_CREATED",
        entityId: user.id,
        details: { role: "ADMIN", dockId: DOCKS[0].id },
      }),
    ]);
    // La contraseña nunca va a la bitácora.
    expect(JSON.stringify(s.audit.entries)).not.toContain("Temporal1xyz");
  });

  it("crea un chofer sin muelle aunque se mande uno", async () => {
    const s = setup();
    await s.create(actor, { ...newAdmin, email: "chofer@pasolanchas.test", role: "DRIVER" });
    expect(s.staff.users[0]).toMatchObject({ role: "DRIVER", dockId: null });
    expect(s.mailer.sent[0].text).toContain("chofer");
  });

  it("pide muelle al administrador y rechaza uno que no existe", async () => {
    const s = setup();
    await expectFieldError(
      s.create(actor, { ...newAdmin, dockId: "" }),
      "dockId",
      "necesita un muelle",
    );
    await expectFieldError(
      s.create(actor, { ...newAdmin, dockId: "00000000-0000-4000-8000-000000000099" }),
      "dockId",
      "de la lista",
    );
    expect(s.staff.users).toHaveLength(0);
  });

  it("no deja crear superadministradores ni pasajeros", async () => {
    const s = setup();
    await expectFieldError(s.create(actor, { ...newAdmin, role: "SUPERADMIN" }), "role", "Elige");
    await expectFieldError(s.create(actor, { ...newAdmin, role: "PASSENGER" }), "role", "Elige");
  });

  it("valida nombre, correo y celular", async () => {
    const s = setup();
    const error = (await s
      .create(actor, { fullName: "A", email: "no-es-correo", phone: "123", role: "DRIVER" })
      .catch((e: unknown) => e)) as InputError;
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["email", "fullName", "phone"]);
  });

  it("rechaza un correo que ya usa otra cuenta", async () => {
    const s = setup([
      memoryStaffUser({ email: "ana.taquilla@pasolanchas.test", role: "PASSENGER" }),
    ]);
    await expectFieldError(s.create(actor, newAdmin), "email", "Ya existe");
    expect(s.audit.entries).toHaveLength(0);
  });

  it("si el correo falla, la cuenta queda creada y la contraseña se muestra igual", async () => {
    const s = setup();
    s.mailer.send = async () => {
      throw new Error("SMTP caído");
    };
    const result = await s.create(actor, newAdmin);
    expect(result).toMatchObject({ temporaryPassword: "Temporal1xyz", emailSent: false });
    expect(s.audit.entries.map((e) => e.action)).toEqual([
      "STAFF_ACCOUNT_CREATED",
      "STAFF_EMAIL_FAILED",
    ]);
  });
});

describe("desactivar y reactivar (RF-118)", () => {
  let driver: MemoryStaffUser;
  beforeEach(() => {
    driver = memoryStaffUser({ role: "DRIVER" });
  });

  it.each(["", "BORRAR", null, undefined])(
    "una acción desconocida (%s) se rechaza sin cambiar nada",
    async (change) => {
      const s = setup([driver]);
      await expect(s.setStatus(actor, driver.id, change)).rejects.toMatchObject({
        code: "INVALID_STATUS_CHANGE",
      });
      expect(driver).toMatchObject({ status: "ACTIVE", sessions: 2 });
      expect(s.audit.entries).toHaveLength(0);
    },
  );

  it("desactivar cierra sus sesiones y queda en la bitácora", async () => {
    const s = setup([driver]);
    await s.setStatus(actor, driver.id, "DEACTIVATE");
    expect(driver).toMatchObject({ status: "INACTIVE", sessions: 0 });
    expect(s.audit.entries[0]).toMatchObject({
      action: "STAFF_ACCOUNT_DEACTIVATED",
      entityId: driver.id,
      details: { from: "ACTIVE", to: "INACTIVE" },
    });
  });

  it("reactiva una cuenta desactivada y no repite cambios", async () => {
    const s = setup([driver]);
    await s.setStatus(actor, driver.id, "DEACTIVATE");
    await expect(s.setStatus(actor, driver.id, "DEACTIVATE")).rejects.toThrow(
      "ya está desactivada",
    );
    await s.setStatus(actor, driver.id, "REACTIVATE");
    expect(driver.status).toBe("ACTIVE");
    await expect(s.setStatus(actor, driver.id, "REACTIVATE")).rejects.toThrow("ya está activa");
  });

  it("si otra petición cambió el estado primero, avisa", async () => {
    const s = setup([driver]);
    const original = s.staff.setStatus;
    s.staff.setStatus = async (id, from, to, entry) => {
      driver.status = "INACTIVE";
      return original(id, from, to, entry);
    };
    await expect(s.setStatus(actor, driver.id, "DEACTIVATE")).rejects.toThrow("cambió mientras");
    expect(s.audit.entries).toHaveLength(0);
  });

  it("no puede tocar a un superadministrador (ni a sí mismo) ni a un pasajero", async () => {
    const superadmin = memoryStaffUser({ id: actor.id, role: "SUPERADMIN" });
    const passenger = memoryStaffUser({ role: "PASSENGER" });
    const s = setup([superadmin, passenger]);
    for (const id of [superadmin.id, passenger.id, "no-es-uuid", undefined]) {
      await expect(s.setStatus(actor, id, "DEACTIVATE")).rejects.toMatchObject({
        code: "STAFF_NOT_FOUND",
      });
    }
    expect(superadmin.status).toBe("ACTIVE");
    expect(passenger.status).toBe("ACTIVE");
  });
});

describe("desbloquear (RF-118)", () => {
  it("limpia los intentos fallidos y el bloqueo", async () => {
    const admin = memoryStaffUser({
      role: "ADMIN",
      failedLoginAttempts: 0,
      lockedUntil: new Date("2026-11-24T12:10:00Z"),
    });
    const s = setup([admin]);
    await s.unlock(actor, admin.id);
    expect(admin).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null });
    expect(s.audit.entries[0].action).toBe("STAFF_ACCOUNT_UNLOCKED");
  });

  it("avisa si la cuenta no tiene bloqueo", async () => {
    const s = setup([memoryStaffUser({ lockedUntil: new Date("2026-11-24T11:00:00Z") })]);
    await expect(s.unlock(actor, s.staff.users[0].id)).rejects.toMatchObject({
      code: "NOT_LOCKED",
    });
  });
});

describe("restablecer la contraseña (RF-119)", () => {
  it("genera una temporal nueva, cierra sesiones y la manda por correo", async () => {
    const driver = memoryStaffUser({ failedLoginAttempts: 3, email: "chofer@pasolanchas.test" });
    const s = setup([driver]);
    const result = await s.resetPassword(actor, driver.id);

    expect(result).toEqual({ temporaryPassword: "Temporal1xyz", emailSent: true });
    expect(driver).toMatchObject({
      passwordHash: "hash:Temporal1xyz",
      mustChangePassword: true,
      failedLoginAttempts: 0,
      sessions: 0,
      resetTokens: 0,
    });
    expect(s.mailer.sent[0]).toMatchObject({ to: "chofer@pasolanchas.test" });
    expect(s.mailer.sent[0].html).toContain("Temporal1xyz");
    expect(s.audit.entries[0]).toMatchObject({
      action: "STAFF_PASSWORD_RESET",
      entityId: driver.id,
    });
  });

  it("no restablece la de un superadministrador", async () => {
    const superadmin = memoryStaffUser({ role: "SUPERADMIN" });
    const s = setup([superadmin]);
    await expect(s.resetPassword(actor, superadmin.id)).rejects.toMatchObject({
      code: "STAFF_NOT_FOUND",
    });
    expect(superadmin.passwordHash).toBe("hash:anterior-2026");
  });
});

describe("lista del personal", () => {
  it("solo muestra administradores y choferes, con filtros por rol y estado", async () => {
    const s = setup([
      memoryStaffUser({ role: "ADMIN" }),
      memoryStaffUser({ role: "DRIVER", status: "INACTIVE" }),
      memoryStaffUser({ role: "SUPERADMIN" }),
      memoryStaffUser({ role: "PASSENGER" }),
    ]);
    expect((await s.list()).accounts).toHaveLength(2);
    expect((await s.list({ role: "DRIVER" })).accounts.map((a) => a.status)).toEqual(["INACTIVE"]);
    expect((await s.list({ status: "ACTIVE" })).accounts.map((a) => a.role)).toEqual(["ADMIN"]);
    // Un filtro desconocido se ignora.
    expect((await s.list({ role: "SUPERADMIN", status: "x" })).filter).toEqual({});
    expect(await s.docks()).toEqual(DOCKS);
    await expect(s.get(s.staff.users[2].id)).rejects.toMatchObject({ code: "STAFF_NOT_FOUND" });
    expect((await s.get(s.staff.users[0].id)).role).toBe("ADMIN");
  });
});
