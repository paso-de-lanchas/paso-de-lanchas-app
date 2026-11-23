import { defineConfig, devices } from "@playwright/test";

// Pruebas de punta a punta (abren un navegador): `npm run test:e2e`.
// La primera vez instala el navegador con: npx playwright install chromium
export default defineConfig({
  testDir: "tests/e2e",
  // Prepara las cuentas de prueba de contraseña en la base local (una vez por corrida).
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // El servidor de desarrollo compila cada ruta la primera vez y Argon2 es lento a propósito:
  // con varias pruebas en paralelo, un inicio de sesión puede tardar más de 5 s.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "on-first-retry",
  },
  projects: [
    // El pasajero usa celular: probamos en tamaño de teléfono.
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
