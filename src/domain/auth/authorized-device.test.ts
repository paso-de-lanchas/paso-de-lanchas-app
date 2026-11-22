import { describe, expect, it } from "vitest";

import { checkDevice, requiresAuthorizedDevice } from "./authorized-device";

const admin = { role: "ADMIN" as const, dockId: "coa" };
const superadmin = { role: "SUPERADMIN" as const, dockId: null };

describe("computadoras autorizadas", () => {
  it("solo las exige al administrador y al superadministrador", () => {
    expect(requiresAuthorizedDevice("PASSENGER")).toBe(false);
    expect(requiresAuthorizedDevice("DRIVER")).toBe(false);
    expect(checkDevice({ role: "DRIVER", dockId: null }, null)).toBe("ALLOWED");
  });

  it("rechaza computadoras desconocidas, pendientes o revocadas", () => {
    expect(checkDevice(admin, null)).toBe("UNKNOWN");
    expect(checkDevice(admin, { status: "PENDING", dockId: "coa" })).toBe("PENDING");
    expect(checkDevice(admin, { status: "REVOKED", dockId: "coa" })).toBe("REVOKED");
  });

  it("el administrador solo entra desde una computadora de su muelle", () => {
    expect(checkDevice(admin, { status: "APPROVED", dockId: "coa" })).toBe("ALLOWED");
    expect(checkDevice(admin, { status: "APPROVED", dockId: "val" })).toBe("WRONG_DOCK");
    expect(checkDevice(admin, { status: "APPROVED", dockId: null })).toBe("WRONG_DOCK");
  });

  it("el superadministrador entra desde cualquier computadora aprobada", () => {
    expect(checkDevice(superadmin, { status: "APPROVED", dockId: "val" })).toBe("ALLOWED");
    expect(checkDevice(superadmin, { status: "APPROVED", dockId: null })).toBe("ALLOWED");
  });
});
