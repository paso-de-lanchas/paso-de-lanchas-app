/**
 * Iniciar y cerrar sesión por rol (issue #7). Usa las cuentas de `prisma/seed.ts`:
 * corre `npm run db:seed` antes.
 */
import { expect, test, type Page } from "@playwright/test";

// La misma contraseña de prueba que SEED_PASSWORD en prisma/seed.ts (solo existe en desarrollo).
const SEED_PASSWORD = "PasoLanchas-dev-2026";

async function login(page: Page, email: string, password = SEED_PASSWORD) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

const accounts = [
  { email: "pasajero@pasolanchas.test", section: "/pasajero", heading: "Pasajero" },
  { email: "chofer1@pasolanchas.test", section: "/chofer", heading: "Chofer" },
  { email: "admin.coa@pasolanchas.test", section: "/admin", heading: "Administrador (taquilla)" },
  { email: "superadmin@pasolanchas.test", section: "/superadmin", heading: "Superadministrador" },
];

for (const account of accounts) {
  test(`${account.heading}: entra a su sección y cierra sesión`, async ({ page }) => {
    await page.goto("/login");
    await login(page, account.email);
    await expect(page).toHaveURL(new RegExp(`${account.section}$`));
    await expect(page.getByRole("heading", { name: account.heading })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(account.section);
    await expect(page).toHaveURL(/\/login\?next=/);
  });
}

test("sin sesión, una sección protegida manda al login y regresa después", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await login(page, "admin.coa@pasolanchas.test");
  await expect(page).toHaveURL(/\/admin$/);
});

test("contraseña incorrecta muestra un mensaje que no revela si el correo existe", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test", "incorrecta");
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  await login(page, "nadie@pasolanchas.test", "incorrecta");
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});

test("un pasajero que abre /admin regresa a su sección", async ({ page }) => {
  await page.goto("/login");
  await login(page, "pasajero@pasolanchas.test");
  await expect(page).toHaveURL(/\/pasajero$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/pasajero$/);

  const session = await page.request.get("/api/auth/session");
  expect((await session.json()).user.role).toBe("PASSENGER");
});

test("la API de sesión responde 401 sin cookie", async ({ request }) => {
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(401);
});
