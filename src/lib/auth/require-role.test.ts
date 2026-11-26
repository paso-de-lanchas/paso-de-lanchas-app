import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/application/auth/ports";

// Se reemplaza la sesión real (cookie + base) y redirect de Next.js, que funciona lanzando.
const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("./auth", () => ({ getCurrentUser: async () => session.user }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { assertRole, requireApiRole, requireRole } = await import("./require-role");

function signedInAs(role: CurrentUser["role"], mustChangePassword = false) {
  session.user = {
    id: "u-1",
    email: "x@pasolanchas.test",
    fullName: "X",
    role,
    mustChangePassword,
  };
}

describe("requireRole (páginas)", () => {
  beforeEach(() => (session.user = null));

  it("sin sesión manda al login", async () => {
    await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT /login");
  });

  it("con otro rol manda a la sección de su rol", async () => {
    signedInAs("PASSENGER");
    await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT /pasajero");
  });

  it("con el rol correcto devuelve el usuario", async () => {
    signedInAs("ADMIN");
    await expect(requireRole("ADMIN", "SUPERADMIN")).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("con contraseña temporal manda a cambiarla (RF-013)", async () => {
    signedInAs("DRIVER", true);
    await expect(requireRole("DRIVER")).rejects.toThrow("REDIRECT /cuenta/cambiar-contrasena");
  });
});

describe("assertRole (Server Actions)", () => {
  beforeEach(() => (session.user = null));

  it("lanza 401 sin sesión y 403 con otro rol", async () => {
    await expect(assertRole("ADMIN")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    signedInAs("DRIVER");
    await expect(assertRole("ADMIN")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("con contraseña temporal lanza 403 aunque tenga el rol", async () => {
    signedInAs("ADMIN", true);
    await expect(assertRole("ADMIN")).rejects.toMatchObject({ status: 403 });
  });
});

describe("requireApiRole (rutas API)", () => {
  beforeEach(() => (session.user = null));

  it("un pasajero recibe 403 en una API de administrador", async () => {
    signedInAs("PASSENGER");
    const result = await requireApiRole("ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toEqual({
        error: "FORBIDDEN",
        message: "No tienes permiso para hacer esto.",
      });
    }
  });

  it("sin sesión recibe 401", async () => {
    const result = await requireApiRole("ADMIN");
    expect(!result.ok && result.response.status).toBe(401);
  });

  it("con el rol correcto devuelve el usuario", async () => {
    signedInAs("ADMIN");
    const result = await requireApiRole("ADMIN");
    expect(result.ok && result.user.role).toBe("ADMIN");
  });
});
