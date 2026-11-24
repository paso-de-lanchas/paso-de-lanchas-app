/**
 * Cuentas del personal (issue #41): el superadministrador crea un chofer, el chofer entra con
 * la contraseña temporal y debe cambiarla; al desactivarlo pierde la sesión al instante.
 * Usa las cuentas de `prisma/seed.ts` (corre `npm run db:seed` antes).
 */
import { expect, test } from "@playwright/test";

import { login, loginFromAuthorizedComputer } from "./auth-helpers";

test("el superadministrador crea un chofer que entra con su contraseña temporal", async ({
  page,
  browser,
}) => {
  // Dos navegadores, dos inicios de sesión con Argon2 y la aprobación de la computadora.
  test.slow();
  const email = `chofer.e2e.${Date.now()}@pasolanchas.test`;

  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "superadmin@pasolanchas.test");
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.getByRole("link", { name: /Personal/ }).click();
  await expect(page).toHaveURL(/\/superadmin\/personal$/);
  await page.getByRole("link", { name: "+ Nueva cuenta" }).click();
  await expect(page).toHaveURL(/\/superadmin\/personal\/nuevo$/);

  await page.getByRole("radio", { name: "Chofer" }).check();
  await page.getByRole("textbox", { name: "Nombre completo" }).fill("Chofer de Playwright");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByRole("textbox", { name: "Celular" }).fill("921 555 0101");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Cuenta creada")).toBeVisible();
  const temporaryPassword = (await page.getByTestId("temporary-password").textContent())!.trim();
  expect(temporaryPassword).toHaveLength(12);

  // El chofer entra desde su celular (otro navegador) y debe cambiar la contraseña.
  const driverContext = await browser.newContext();
  const driverPage = await driverContext.newPage();
  await driverPage.goto("/login");
  await login(driverPage, email, temporaryPassword);
  await expect(driverPage).toHaveURL(/\/cuenta\/cambiar-contrasena$/);
  await driverPage.getByLabel("Contraseña temporal").fill(temporaryPassword);
  await driverPage.getByLabel("Contraseña nueva", { exact: true }).fill("chofer-nueva-2026");
  await driverPage.getByLabel("Repite la contraseña nueva").fill("chofer-nueva-2026");
  await driverPage.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(driverPage).toHaveURL(/\/chofer$/);

  // El superadministrador lo desactiva: su sesión deja de servir.
  await page.getByRole("link", { name: "Ver la cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Chofer de Playwright" })).toBeVisible();
  await page.getByRole("button", { name: "Desactivar cuenta" }).click();
  await expect(page.getByText("Cuenta desactivada. Se cerraron sus sesiones.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivar cuenta" })).toBeVisible();

  await driverPage.reload();
  await expect(driverPage).toHaveURL(/\/login/);
  await login(driverPage, email, "chofer-nueva-2026");
  await expect(driverPage.getByText("Tu cuenta está bloqueada o inactiva")).toBeVisible();
  await driverContext.close();
});

test("el chofer del seed con contraseña temporal solo puede cambiarla", async ({ page }) => {
  await page.goto("/chofer");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "chofer.temporal@pasolanchas.test");
  await expect(page).toHaveURL(/\/cuenta\/cambiar-contrasena$/);
  await expect(page.getByText("Tu contraseña es temporal")).toBeVisible();
});
