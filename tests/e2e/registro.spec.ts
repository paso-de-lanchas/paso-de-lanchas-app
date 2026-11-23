/**
 * Registro de pasajero con verificación de correo (issue #6). El correo se lee de Mailpit
 * (http://localhost:8025): requiere `docker compose up -d`.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const MAILPIT = "http://localhost:8025";

/** Espera el correo más reciente enviado a `to` y devuelve su texto. */
async function readLatestEmail(request: APIRequestContext, to: string): Promise<string> {
  let text = "";
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:"${to}"` },
    });
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    expect(messages.length).toBeGreaterThan(0);
    const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
    text = ((await message.json()) as { Text: string }).Text;
  }).toPass({ timeout: 10_000 });
  return text;
}

test("un pasajero se registra, confirma su correo e inicia sesión", async ({ page, request }) => {
  const email = `pasajero-${Date.now()}@pasolanchas.test`;
  const password = "lancha2026";

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Pasajera Nueva");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Celular").fill("921 123 4567");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("Leí y acepto el aviso de privacidad").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();

  // Sin confirmar, todavía no puede entrar.
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("Confirma tu correo con el enlace")).toBeVisible();

  const text = await readLatestEmail(request, email);
  const link = text.match(/https?:\/\/\S+\/verificar-correo\?token=\S+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
  await page.getByRole("button", { name: "Confirmar mi correo" }).click();
  await expect(page.getByText("¡Listo! Tu cuenta está activa.")).toBeVisible();

  // El mismo enlace ya no sirve.
  await page.goto(link!);
  await page.getByRole("button", { name: "Confirmar mi correo" }).click();
  await expect(page.getByText("Este enlace ya se usó")).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/pasajero$/);
});

test("el registro marca los datos inválidos sin perder lo escrito", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Correo electrónico").fill("ana@pasolanchas.test");
  await page.getByLabel("Celular").fill("12345");
  await page.getByLabel("Contraseña").fill("soloLetras");
  await page.getByLabel("Leí y acepto el aviso de privacidad").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByText("Escribe tu celular a 10 dígitos.")).toBeVisible();
  await expect(
    page.getByText("La contraseña debe tener al menos una letra y un número."),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("Ana Pérez");
});

test("con un correo ya registrado la respuesta es la misma", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Alguien");
  await page.getByLabel("Correo electrónico").fill("pasajero@pasolanchas.test");
  await page.getByLabel("Celular").fill("9211234567");
  await page.getByLabel("Contraseña").fill("lancha2026");
  await page.getByLabel("Leí y acepto el aviso de privacidad").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Revisa tu correo")).toBeVisible();
});
