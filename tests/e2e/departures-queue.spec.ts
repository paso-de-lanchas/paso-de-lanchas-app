import { expect, test } from "@playwright/test";

import { loginFromAuthorizedComputer } from "./auth-helpers";

test("forma una embarcacion en el muelle, aborda y cierra abordaje", async ({ page }) => {
  test.slow();
  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "admin.coa@pasolanchas.test");
  await page.goto("/admin/operacion");

  const vesselSelect = page.locator("form").first().locator("select").first();
  const destSelect = page.locator("form").first().locator("select").nth(1);
  const addButton = page.getByRole("button", { name: /agregar a la fila/i });

  const firstOption = vesselSelect.locator("option:not([disabled])").first();
  const destOption = destSelect.locator("option").first();
  await expect(firstOption).toHaveCount(1);
  await expect(destOption).toHaveCount(1);

  const vesselId = await firstOption.getAttribute("value");
  const destId = await destOption.getAttribute("value");
  expect(vesselId).toBeTruthy();
  expect(destId).toBeTruthy();

  await vesselSelect.selectOption(vesselId!);
  await destSelect.selectOption(destId!);
  await addButton.click();

  const closeBoardingButton = page.getByRole("button", { name: /cerrar abordaje/i });
  await expect(closeBoardingButton).toBeVisible();
  await closeBoardingButton.click();

  await expect(closeBoardingButton).toHaveCount(0);
});
