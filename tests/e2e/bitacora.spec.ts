/** Bitácora del superadministrador (#69, RF-122 a RF-124). */
import { expect, test } from "@playwright/test";

import { login, loginFromAuthorizedComputer } from "./auth-helpers";

test("el superadministrador ve su inicio de sesión en la bitácora y la filtra", async ({
  page,
}) => {
  test.slow();
  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "superadmin@pasolanchas.test");
  await expect(page).toHaveURL(/\/superadmin/);

  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Bitácora" })
    .click();
  await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();

  await page.getByLabel("Acción").selectOption("LOGIN_SUCCEEDED");
  await page.getByLabel("Usuario (correo)").fill("superadmin@pasolanchas.test");
  await page.getByRole("button", { name: "Filtrar" }).click();

  await expect(page).toHaveURL(/accion=LOGIN_SUCCEEDED/);
  const firstRow = page.getByRole("row").nth(1);
  await expect(firstRow).toContainText("Inicio de sesión");
  await expect(firstRow).toContainText("superadmin@pasolanchas.test");

  // Un filtro alterado a mano no truena la página: se ignora y se avisa.
  await page.goto("/superadmin/bitacora?accion=drop%20table&desde=2026-02-31");
  await expect(page.getByRole("alert").filter({ hasText: "Se ignoró" })).toContainText("acción");
  await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();
});

test("un pasajero no puede abrir la bitácora", async ({ page }) => {
  // El primer inicio de sesión compila la ruta y Argon2 es lento a propósito: más margen.
  test.slow();
  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test");
  await expect(page).toHaveURL(/\/pasajero/);
  await page.goto("/superadmin/bitacora");
  await expect(page).toHaveURL(/\/pasajero/);
});

test("sin sesión la bitácora manda al login", async ({ page }) => {
  await page.goto("/superadmin/bitacora");
  await expect(page).toHaveURL(/\/login/);
});
