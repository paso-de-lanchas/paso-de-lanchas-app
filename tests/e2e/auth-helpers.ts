/**
 * Iniciar sesión en las pruebas de navegador con las cuentas de `prisma/seed.ts`
 * (corre `npm run db:seed` antes).
 */
import { execSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

// La misma contraseña de prueba que SEED_PASSWORD en prisma/seed.ts (solo existe en desarrollo).
export const SEED_PASSWORD = "PasoLanchas-dev-2026";

export const DEVICE_PENDING = "Esta computadora todavía no está autorizada";

export async function login(page: Page, email: string, password = SEED_PASSWORD) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/**
 * El administrador y el superadministrador necesitan una computadora autorizada: cada prueba
 * usa un navegador nuevo (computadora nueva), así que la primera vez se crea la solicitud,
 * se aprueba con el script de desarrollo y se vuelve a entrar.
 */
export async function loginFromAuthorizedComputer(page: Page, email: string) {
  await login(page, email);
  await expect(page.getByText(DEVICE_PENDING)).toBeVisible();
  // Solo las de esta cuenta: las pruebas corren en paralelo y otra puede tener una pendiente.
  execSync(`npm run dev:aprobar-computadoras -- ${email}`, { stdio: "ignore" });
  await login(page, email);
}
