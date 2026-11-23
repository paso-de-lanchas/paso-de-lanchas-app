/**
 * Recuperar y cambiar contraseña (issue #8). El correo se lee de Mailpit y las cuentas las
 * prepara `global-setup.ts` en la base local: requiere `docker compose up -d`.
 */
import { expect, test, type Page } from "@playwright/test";

import { E2E_ACCOUNTS } from "./accounts";
import { readLatestEmail } from "./support";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test("recupera la contraseña con el enlace del correo, que sirve una sola vez", async ({
  page,
  request,
}) => {
  // Flujo largo (correo, dos cambios y dos inicios de sesión): se le da más tiempo.
  test.slow();
  const { email } = E2E_ACCOUNTS.recover;

  await page.goto("/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/recuperar$/);
  // Next.js deja oculta la pantalla anterior (también tiene "Correo electrónico"): getByRole
  // solo encuentra la visible.
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();

  const text = await readLatestEmail(request, email);
  const link = text.match(/https?:\/\/\S+\/recuperar\/[\w-]+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("nueva-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("nueva-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("¡Listo! Tu contraseña cambió.")).toBeVisible();

  // El mismo enlace ya no sirve.
  await page.goto(link!);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("otra-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("otra-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Este enlace ya se usó")).toBeVisible();

  await login(page, email, "vieja-2026");
  await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  await login(page, email, "nueva-2026");
  await expect(page).toHaveURL(/\/pasajero$/);
});

test("pedir enlace con un correo sin cuenta responde igual", async ({ page }) => {
  await page.goto("/recuperar");
  await page.getByLabel("Correo electrónico").fill("nadie.sin.cuenta@pasolanchas.test");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();
});

test("con contraseña temporal solo puede cambiarla antes de seguir (RF-013)", async ({ page }) => {
  const { email } = E2E_ACCOUNTS.temporary;

  await login(page, email, "temporal-2026");
  await expect(page).toHaveURL(/\/cuenta\/cambiar-contrasena$/);
  await expect(page.getByText("Tu contraseña es temporal")).toBeVisible();

  // No puede ir a su sección hasta cambiarla.
  await page.goto("/chofer");
  await expect(page).toHaveURL(/\/cuenta\/cambiar-contrasena$/);

  await page.getByLabel("Contraseña temporal").fill("temporal-2026");
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("propia-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("propia-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page).toHaveURL(/\/chofer$/);
});

test("cambiar la contraseña pide la actual", async ({ page }) => {
  const { email } = E2E_ACCOUNTS.change;
  await login(page, email, "actual-2026");
  await expect(page).toHaveURL(/\/pasajero$/);

  await page.getByRole("link", { name: "Cambiar contraseña" }).click();
  await expect(page).toHaveURL(/\/cuenta\/cambiar-contrasena$/);
  await page.getByLabel("Contraseña actual").fill("equivocada-2026");
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("nueva-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("nueva-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("La contraseña actual no es correcta.")).toBeVisible();

  await page.getByLabel("Contraseña actual").fill("actual-2026");
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("nueva-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("nueva-2026");
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page).toHaveURL(/\/pasajero$/);
});
