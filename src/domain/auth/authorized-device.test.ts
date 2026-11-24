import { describe, expect, it } from "vitest";

import {
  canApproveDevice,
  canRevokeDevice,
  checkDevice,
  isValidDeviceDock,
  requiresAuthorizedDevice,
} from "./authorized-device";

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

describe("aprobar y revocar computadoras (RF-121)", () => {
  it("solo aprueba pendientes y revoca pendientes o aprobadas", () => {
    expect(canApproveDevice("PENDING")).toBe(true);
    expect(canApproveDevice("APPROVED")).toBe(false);
    expect(canApproveDevice("REVOKED")).toBe(false);
    expect(canRevokeDevice("PENDING")).toBe(true);
    expect(canRevokeDevice("APPROVED")).toBe(true);
    expect(canRevokeDevice("REVOKED")).toBe(false);
  });

  it("la computadora de un administrador debe ser de su muelle; la del superadmin, de cualquiera u oficina", () => {
    expect(isValidDeviceDock(admin, null)).toBe(false);
    expect(isValidDeviceDock(admin, "val")).toBe(false);
    expect(isValidDeviceDock(admin, "coa")).toBe(true);
    // Lo que se aprueba es lo mismo que el login acepta después.
    expect(checkDevice(admin, { status: "APPROVED", dockId: "coa" })).toBe("ALLOWED");
    expect(isValidDeviceDock(superadmin, null)).toBe(true);
    expect(isValidDeviceDock(superadmin, "coa")).toBe(true);
  });
});
