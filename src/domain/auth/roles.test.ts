import { describe, expect, it } from "vitest";

import {
  authorize,
  canAccessPath,
  homePathFor,
  isProtectedPath,
  redirectAfterLogin,
  sectionOf,
} from "./roles";

describe("roles y secciones", () => {
  it("lleva a cada rol a su sección", () => {
    expect(homePathFor("PASSENGER")).toBe("/pasajero");
    expect(homePathFor("DRIVER")).toBe("/chofer");
    expect(homePathFor("ADMIN")).toBe("/admin");
    expect(homePathFor("SUPERADMIN")).toBe("/superadmin");
  });

  it("reconoce las rutas protegidas y sus subrutas, sin confundir prefijos", () => {
    expect(sectionOf("/admin")).toBe("/admin");
    expect(sectionOf("/admin/tarifas")).toBe("/admin");
    expect(sectionOf("/administracion")).toBeNull();
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/chofer/viaje")).toBe(true);
  });

  it("solo deja entrar a la sección del propio rol", () => {
    expect(canAccessPath("PASSENGER", "/pasajero/saldo")).toBe(true);
    expect(canAccessPath("PASSENGER", "/admin")).toBe(false);
    expect(canAccessPath("ADMIN", "/superadmin")).toBe(false);
    expect(canAccessPath("DRIVER", "/login")).toBe(true);
  });
});

describe("authorize", () => {
  it("distingue sin sesión, sin permiso y permitido", () => {
    expect(authorize(null, ["ADMIN"])).toBe("UNAUTHENTICATED");
    expect(authorize({ role: "PASSENGER" }, ["ADMIN"])).toBe("FORBIDDEN");
    expect(authorize({ role: "ADMIN" }, ["ADMIN", "SUPERADMIN"])).toBe("ALLOWED");
  });
});

describe("redirectAfterLogin", () => {
  it("usa la ruta pedida si es de su sección", () => {
    expect(redirectAfterLogin("ADMIN", "/admin/tarifas")).toBe("/admin/tarifas");
  });

  it("ignora rutas de otra sección, externas o mal formadas", () => {
    expect(redirectAfterLogin("PASSENGER", "/admin")).toBe("/pasajero");
    expect(redirectAfterLogin("PASSENGER", "https://malo.com")).toBe("/pasajero");
    expect(redirectAfterLogin("PASSENGER", "//malo.com/pasajero")).toBe("/pasajero");
    expect(redirectAfterLogin("PASSENGER", "/\\malo.com")).toBe("/pasajero");
    expect(redirectAfterLogin("PASSENGER", "/pasajero\r\nSet-Cookie: x")).toBe("/pasajero");
    expect(redirectAfterLogin("DRIVER", "/")).toBe("/chofer");
    expect(redirectAfterLogin("DRIVER", null)).toBe("/chofer");
  });
});
