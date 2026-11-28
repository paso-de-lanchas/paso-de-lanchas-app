/** Notificaciones in-app y preferencias del pasajero (#74, RF-106 a RF-109). */
import { expect, test } from "@playwright/test";

import { login } from "./auth-helpers";

test("el pasajero consulta sus notificaciones y activa o desactiva sus preferencias (RF-109)", async ({
  page,
}) => {
  test.slow();
  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test");
  await expect(page).toHaveURL(/\/pasajero/);

  // 1. Verificar sección de notificaciones y contador en el inicio del pasajero
  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
  await expect(page.getByLabel("Contador de notificaciones sin leer")).toBeVisible();

  // 2. Ir a Mi cuenta y desactivar notificaciones (RF-109)
  await page.getByRole("link", { name: /Mi cuenta/i }).click();
  await expect(page).toHaveURL(/\/pasajero\/cuenta/);

  const toggle = page.getByRole("switch", {
    name: "Activar o desactivar notificaciones",
  });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText("Notificaciones desactivadas. Ya no recibirás nuevos avisos."),
  ).toBeVisible();

  // 3. Recargar para confirmar que la preferencia persistió en PostgreSQL y volver a activar
  await page.reload();
  const toggleAfterReload = page.getByRole("switch", {
    name: "Activar o desactivar notificaciones",
  });
  await expect(toggleAfterReload).toHaveAttribute("aria-checked", "false");

  await toggleAfterReload.click();
  await expect(toggleAfterReload).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText("Notificaciones activadas. Recibirás avisos de saldo y viajes."),
  ).toBeVisible();
});

test("sin sesión la API de notificaciones del pasajero rechaza el acceso", async ({ request }) => {
  const response = await request.get("/api/pasajero/notificaciones");
  expect(response.status()).toBe(401);
});
