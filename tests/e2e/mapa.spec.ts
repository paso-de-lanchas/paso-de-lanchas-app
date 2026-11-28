/**
 * Mapa en vivo (#72). La ubicación la pone scripts/dev-simular-viaje.ts, como lo hará el
 * celular del chofer (#49).
 */
import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { login, loginFromAuthorizedComputer } from "./auth-helpers";

function simulateHalfway() {
  execSync("npx tsx scripts/dev-simular-viaje.ts --once 0.5", { stdio: "ignore" });
}

// Las dos pruebas usan el mismo viaje simulado: en serie, y se prepara una sola vez.
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  simulateHalfway();
});

test.afterAll(() => {
  execSync("npx tsx scripts/dev-simular-viaje.ts --terminar", { stdio: "ignore" });
});

test("el pasajero ve la lancha en camino con su llegada estimada", async ({ page }) => {
  test.slow();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test");
  await expect(page).toHaveURL(/\/pasajero/);
  await page.getByRole("link", { name: "Ver el mapa en vivo" }).click();

  await expect(page.getByRole("heading", { name: "Mapa en vivo" })).toBeVisible();
  const vessel = page.getByRole("listitem").filter({ hasText: "Lancha simulada" });
  await expect(vessel).toContainText("Coatzacoalcos → Villa Allende");
  await expect(vessel).toContainText(/Llega en\s*\d+ min|Por llegar/);
  // El pasajero no ve la ocupación (eso es del admin, RF-081).
  await expect(vessel).not.toContainText("a bordo");

  // El mapa carga su worker sin errores (MapLibre 6 lo busca en /vendor).
  await expect(
    page.getByLabel("Mapa de los muelles y las embarcaciones en tránsito"),
  ).toBeVisible();
  await page.waitForTimeout(2000);
  expect(consoleErrors.filter((e) => /worker/i.test(e))).toEqual([]);
});

test("el admin ve la ocupación de las embarcaciones en tránsito", async ({ page }) => {
  test.slow();

  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "admin.val@pasolanchas.test");
  await expect(page).toHaveURL(/\/admin/);
  await page.goto("/admin/mapa");

  const vessel = page.getByRole("listitem").filter({ hasText: "Lancha simulada" });
  await expect(vessel).toContainText("8/20 a bordo");
});

test("la API del mapa pide sesión", async ({ request }) => {
  const response = await request.get("/api/mapa");
  expect(response.status()).toBe(401);
});
