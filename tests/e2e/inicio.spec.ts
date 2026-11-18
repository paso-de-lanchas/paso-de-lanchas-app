import { expect, test } from "@playwright/test";

test("la página de inicio muestra las secciones por rol", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Paso de Lanchas")).toBeVisible();
  await page.getByRole("link", { name: "Pasajero" }).click();
  await expect(page.getByRole("heading", { name: "Pasajero" })).toBeVisible();
});

test("el servidor llega a la base de datos", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});
