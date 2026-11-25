/**
 * Computadoras del muelle (issue #42): un administrador nuevo entra desde una computadora
 * desconocida, el superadministrador la aprueba en su pantalla, el administrador entra, y al
 * revocarla pierde la sesión. Usa las cuentas de `prisma/seed.ts` (corre `npm run db:seed`).
 */
import { expect, test } from "@playwright/test";

import { DEVICE_PENDING, login, loginFromAuthorizedComputer } from "./auth-helpers";

test("el superadministrador aprueba y revoca la computadora de un administrador", async ({
  page,
  browser,
}) => {
  // Dos navegadores, cuatro inicios de sesión con Argon2 y varias pantallas.
  test.slow();
  const stamp = Date.now();
  const adminName = `Admin E2E ${stamp}`;
  const adminEmail = `admin.e2e.${stamp}@pasolanchas.test`;

  // 1. El superadministrador crea la cuenta del administrador (issue #41).
  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "superadmin@pasolanchas.test");
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.goto("/superadmin/personal/nuevo");
  await page.getByRole("textbox", { name: "Nombre completo" }).fill(adminName);
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(adminEmail);
  await page.getByRole("textbox", { name: "Celular" }).fill("921 555 0202");
  await page.getByRole("combobox", { name: "Muelle" }).selectOption({ label: "Villa Allende" });
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  const temporaryPassword = (await page.getByTestId("temporary-password").textContent())!.trim();

  // 2. El administrador entra desde su computadora (otro navegador): queda pendiente.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login");
  await login(adminPage, adminEmail, temporaryPassword);
  await expect(adminPage.getByText(DEVICE_PENDING)).toBeVisible();

  // 3. El superadministrador ve la solicitud y la aprueba con nombre y muelle.
  await page.goto("/superadmin/computadoras");
  const request = page.getByRole("article", { name: `Computadora de ${adminName}` });
  await expect(request.getByText(adminEmail)).toBeVisible();
  await expect(request.getByRole("combobox", { name: "Muelle" })).toHaveValue(/.+/);
  await request.getByRole("textbox", { name: "Nombre" }).fill(`Taquilla E2E ${stamp}`);
  await request.getByRole("button", { name: "Aprobar" }).click();
  await expect(request).toHaveCount(0);

  // 4. Ya entra (y como su contraseña es temporal, primero debe cambiarla).
  await login(adminPage, adminEmail, temporaryPassword);
  await expect(adminPage).toHaveURL(/\/cuenta\/cambiar-contrasena$/);

  // 5. Al revocarla, su sesión deja de servir y no puede volver a entrar desde ahí.
  await page.goto("/superadmin/computadoras?estado=APPROVED");
  const approved = page.getByRole("article", { name: `Taquilla E2E ${stamp}` });
  await expect(approved.getByText("Villa Allende")).toBeVisible();
  await approved.getByRole("button", { name: "Revocar acceso" }).click();
  await expect(approved).toHaveCount(0);

  await adminPage.reload();
  await expect(adminPage).toHaveURL(/\/login/);
  await login(adminPage, adminEmail, temporaryPassword);
  await expect(adminPage.getByText("El acceso desde esta computadora fue retirado")).toBeVisible();

  await page.goto("/superadmin/computadoras?estado=REVOKED");
  await expect(page.getByRole("article", { name: `Taquilla E2E ${stamp}` })).toBeVisible();
  await adminContext.close();
});
