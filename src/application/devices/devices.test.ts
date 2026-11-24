import { describe, expect, it } from "vitest";

import { fixedClock, memoryAudit } from "../auth/test-doubles";
import { InputError } from "../shared/input-error";
import { DOCKS } from "../staff/test-doubles";
import {
  createApproveDevice,
  createListDevices,
  createRenameDevice,
  createRevokeDevice,
} from "./device-use-cases";
import type { DeviceAdminRepository, DeviceView } from "./ports";

const actor = { id: "00000000-0000-4000-8000-0000000000aa" };
const ADMIN_ID = "00000000-0000-4000-8000-000000000d01";
const OFFICE_ID = "00000000-0000-4000-8000-000000000d02";
const APPROVED_ID = "00000000-0000-4000-8000-000000000d03";

function device(overrides: Partial<DeviceView>): DeviceView {
  return {
    id: ADMIN_ID,
    name: "Computadora de Admin",
    status: "PENDING",
    dockId: DOCKS[0].id,
    dockName: DOCKS[0].name,
    requestedBy: {
      fullName: "Admin",
      email: "admin@pasolanchas.test",
      role: "ADMIN",
      dockId: DOCKS[0].id,
    },
    requestedAt: new Date("2026-11-24T10:00:00Z"),
    approvedByName: null,
    approvedAt: null,
    lastSeenAt: null,
    ...overrides,
  };
}

function setup() {
  const items: (DeviceView & { sessions: number; approvedById?: string })[] = [
    { ...device({}), sessions: 0 },
    {
      ...device({
        id: OFFICE_ID,
        dockId: null,
        dockName: null,
        requestedBy: {
          fullName: "Super",
          email: "super@pasolanchas.test",
          role: "SUPERADMIN",
          dockId: null,
        },
      }),
      sessions: 0,
    },
    { ...device({ id: APPROVED_ID, status: "APPROVED", name: "Taquilla COA 1" }), sessions: 2 },
  ];
  const byId = (id: string) => items.find((d) => d.id === id);
  const devices: DeviceAdminRepository = {
    list: async (status) => items.filter((d) => d.status === status),
    // Copia, como Prisma: lo que lee el caso de uso no cambia si después se modifica.
    findById: async (id) => {
      const d = byId(id);
      return d ? { ...d } : null;
    },
    listDocks: async () => DOCKS,
    dockExists: async (id) => DOCKS.some((d) => d.id === id),
    approve: async (id, data) => {
      const d = byId(id)!;
      if (d.status !== "PENDING") return false;
      Object.assign(d, {
        status: "APPROVED",
        name: data.name,
        dockId: data.dockId,
        approvedById: data.approvedById,
        approvedAt: data.at,
      });
      return true;
    },
    revoke: async (id) => {
      const d = byId(id)!;
      if (d.status === "REVOKED") return false;
      Object.assign(d, { status: "REVOKED", sessions: 0 });
      return true;
    },
    rename: async (id, name) => {
      const d = byId(id)!;
      if (d.status === "REVOKED") return false;
      d.name = name;
      return true;
    },
  };
  const audit = memoryAudit();
  const deps = { devices, audit, clock: fixedClock("2026-11-24T12:00:00Z") };
  return {
    items,
    devices,
    audit,
    list: createListDevices(deps),
    approve: createApproveDevice(deps),
    revoke: createRevokeDevice(deps),
    rename: createRenameDevice(deps),
  };
}

describe("computadoras del muelle (RF-120, RF-121)", () => {
  it("lista por estado y, si el estado no existe, muestra las pendientes", async () => {
    const s = setup();
    expect((await s.list("APPROVED")).devices.map((d) => d.id)).toEqual([APPROVED_ID]);
    const pending = await s.list("cualquier-cosa");
    expect(pending.status).toBe("PENDING");
    expect(pending.devices).toHaveLength(2);
    expect(pending.docks).toEqual(DOCKS);
  });

  it("aprueba la computadora de un administrador en un muelle, con nombre y bitácora", async () => {
    const s = setup();
    await s.approve(actor, ADMIN_ID, { name: "  Taquilla VAL 1 ", dockId: DOCKS[1].id });
    expect(s.items[0]).toMatchObject({
      status: "APPROVED",
      name: "Taquilla VAL 1",
      dockId: DOCKS[1].id,
      approvedById: actor.id,
      approvedAt: new Date("2026-11-24T12:00:00Z"),
    });
    expect(s.audit.entries[0]).toMatchObject({
      userId: actor.id,
      action: "DEVICE_APPROVED",
      entity: "authorized_device",
      entityId: ADMIN_ID,
    });
  });

  it("la de un administrador no puede quedar de oficina; la del superadmin sí", async () => {
    const s = setup();
    const error = await s.approve(actor, ADMIN_ID, { name: "Oficina", dockId: "" }).catch((e) => e);
    expect(error).toBeInstanceOf(InputError);
    expect((error as InputError).fieldErrors).toMatchObject({
      dockId: expect.stringContaining("muelle"),
    });

    await s.approve(actor, OFFICE_ID, { name: "Oficina central", dockId: "" });
    expect(s.items[1]).toMatchObject({ status: "APPROVED", dockId: null });
  });

  it("rechaza un muelle inexistente, un nombre corto y aprobar dos veces", async () => {
    const s = setup();
    await expect(
      s.approve(actor, ADMIN_ID, {
        name: "Taquilla",
        dockId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toBeInstanceOf(InputError);
    await expect(
      s.approve(actor, ADMIN_ID, { name: "ab", dockId: DOCKS[0].id }),
    ).rejects.toBeInstanceOf(InputError);
    await expect(
      s.approve(actor, APPROVED_ID, { name: "Otra", dockId: DOCKS[0].id }),
    ).rejects.toMatchObject({
      code: "DEVICE_NOT_PENDING",
    });
    await expect(s.approve(actor, "no-es-uuid", { name: "Otra" })).rejects.toMatchObject({
      code: "DEVICE_NOT_FOUND",
    });
  });

  it("si otra petición la aprobó primero, avisa", async () => {
    const s = setup();
    s.devices.approve = async () => false;
    await expect(
      s.approve(actor, ADMIN_ID, { name: "Taquilla", dockId: DOCKS[0].id }),
    ).rejects.toMatchObject({ code: "DEVICE_CHANGED" });
    expect(s.audit.entries).toHaveLength(0);
  });

  it("revocar corta sus sesiones; rechazar una pendiente también es revocarla", async () => {
    const s = setup();
    await s.revoke(actor, APPROVED_ID);
    expect(s.items[2]).toMatchObject({ status: "REVOKED", sessions: 0 });
    expect(s.audit.entries[0]).toMatchObject({
      action: "DEVICE_REVOKED",
      details: { from: "APPROVED" },
    });

    await s.revoke(actor, ADMIN_ID);
    expect(s.items[0].status).toBe("REVOKED");
    await expect(s.revoke(actor, ADMIN_ID)).rejects.toMatchObject({
      code: "DEVICE_ALREADY_REVOKED",
    });
  });

  it("renombra una computadora aprobada pero no una revocada", async () => {
    const s = setup();
    await s.rename(actor, APPROVED_ID, "Taquilla COA principal");
    expect(s.items[2].name).toBe("Taquilla COA principal");
    expect(s.audit.entries[0]).toMatchObject({
      action: "DEVICE_RENAMED",
      details: { from: "Taquilla COA 1", to: "Taquilla COA principal" },
    });

    await s.revoke(actor, APPROVED_ID);
    await expect(s.rename(actor, APPROVED_ID, "Otra vez")).rejects.toMatchObject({
      code: "DEVICE_REVOKED",
    });
    await expect(s.rename(actor, APPROVED_ID, "x")).rejects.toBeInstanceOf(InputError);
  });
});
