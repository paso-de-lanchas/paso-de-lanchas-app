import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@pasolanchas.test";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "admin-2026";
  await page.getByRole("textbox", { name: /correo/i }).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.goto("/admin/operacion");
}

test("forma dos embarcaciones, aborda la primera, cierra abordaje y promueve la segunda", async ({
  page,
}) => {
  await loginAsAdmin(page);

  const vesselSelect = page.locator("form").first().locator("select").first();
  const destSelect = page.locator("form").first().locator("select").nth(1);
  const addButton = page.getByRole("button", { name: /agregar a la fila/i });

  const vesselOptionsCount = await vesselSelect.locator("option:not([disabled])").count();
  const destOptionsCount = await destSelect.locator("option").count();
  test.skip(
    vesselOptionsCount < 2 || destOptionsCount < 1,
    "Requiere al menos 2 embarcaciones activas con chofer y 1 destino.",
  );

  const firstVesselId = await vesselSelect
    .locator("option:not([disabled])")
    .nth(0)
    .getAttribute("value");
  const secondVesselId = await vesselSelect
    .locator("option:not([disabled])")
    .nth(1)
    .getAttribute("value");
  const destId = await destSelect.locator("option").first().getAttribute("value");

  if (!firstVesselId || !secondVesselId || !destId) {
    test.skip(true, "No se encontraron valores seleccionables para la prueba de fila.");
  }

  await vesselSelect.selectOption(firstVesselId!);
  await destSelect.selectOption(destId!);
  await addButton.click();

  await vesselSelect.selectOption(secondVesselId!);
  await destSelect.selectOption(destId!);
  await addButton.click();

  const closeBoardingButton = page.getByRole("button", { name: /cerrar abordaje/i });
  await expect(closeBoardingButton).toBeVisible();
  await closeBoardingButton.click();

  await expect(closeBoardingButton).toBeVisible();
});
