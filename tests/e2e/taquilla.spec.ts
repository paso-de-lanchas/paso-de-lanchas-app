/**
 * Escaneo del QR en la taquilla (#44), de punta a punta: el lector USB "escribe" el QR,
 * se cobra, se asigna el lugar y el pasajero lo ve en su celular.
 * Los datos los prepara scripts/dev-e2e-boarding.ts (muelle de Villa Allende).
 */
import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { login, loginFromAuthorizedComputer } from "./auth-helpers";

const PASSENGER = "pasajero.abordaje@pasolanchas.test";

function boardingScript(args = ""): string {
  const output = execSync(`npx tsx scripts/dev-e2e-boarding.ts ${args}`, { encoding: "utf8" });
  return (JSON.parse(output.trim().split("\n").at(-1)!) as { qr: string }).qr;
}

test("el admin escanea el QR: cobra, asigna lugar y el pasajero lo ve", async ({
  page,
  browser,
}) => {
  test.slow();
  boardingScript(); // salida abordando + pasajero con $100 y credencial QR

  await page.goto("/login");
  await loginFromAuthorizedComputer(page, "admin.val@pasolanchas.test");
  await expect(page).toHaveURL(/\/admin/);
  await page.goto("/admin/taquilla");

  await expect(page.getByText("Lancha de pruebas")).toBeVisible();
  await expect(page.getByLabel("Lugares ocupados")).toHaveText("0/5");

  // Un QR inventado se rechaza sin cobrar.
  const qrField = page.getByRole("textbox", { name: /código qr/i });
  await qrField.fill("PL1.00000000-0000-4000-8000-000000000000.123456");
  await qrField.press("Enter");
  await expect(page.getByRole("alert", { name: "Escaneo rechazado" })).toContainText(
    "QR no válido",
  );

  // El QR vigente cobra y asigna el lugar 1.
  const qr = boardingScript("--qr-only");
  await qrField.fill(qr);
  await qrField.press("Enter");
  const confirmation = page.getByRole("status", { name: "Abordaje registrado" });
  await expect(confirmation).toContainText("Pasajera de abordaje");
  await expect(confirmation).toContainText("Lugar 1");
  await expect(page.getByLabel("Lugares ocupados")).toHaveText("1/5");

  // El mismo QR otra vez: no se cobra dos veces.
  await qrField.fill(qr);
  await qrField.press("Enter");
  await expect(page.getByRole("alert", { name: "Escaneo rechazado" })).toContainText(
    /ya abordó|ya se usó/,
  );
  await expect(page.getByLabel("Lugares ocupados")).toHaveText("1/5");

  // El pasajero ve su lugar en el celular.
  const passengerContext = await browser.newContext();
  const passengerPage = await passengerContext.newPage();
  await passengerPage.goto("/login");
  await login(passengerPage, PASSENGER);
  await expect(passengerPage).toHaveURL(/\/pasajero/);
  const notice = passengerPage.getByRole("status", { name: "Tu abordaje" });
  await expect(notice).toContainText("Lugar 1");
  await expect(notice).toContainText("Lancha de pruebas");
  await passengerContext.close();
});

test("sin sesión de admin no se puede abrir la taquilla", async ({ page }) => {
  await page.goto("/admin/taquilla");
  await expect(page).toHaveURL(/\/login/);
});

test("un pasajero no puede consultar la taquilla ni el abordaje de otro", async ({ page }) => {
  // El primer inicio de sesión compila la ruta y Argon2 es lento a propósito: más margen.
  test.slow();
  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test");
  await expect(page).toHaveURL(/\/pasajero/);
  await page.goto("/admin/taquilla");
  await expect(page).toHaveURL(/\/pasajero/);
  // La API solo devuelve el abordaje del pasajero de la sesión.
  const response = await page.request.get("/api/pasajero/abordaje");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { boarding: { vesselName: string } | null };
  expect(body.boarding?.vesselName).not.toBe("Lancha de pruebas");
});
