/**
 * Ayudas de las pruebas de navegador. Requieren `docker compose up -d`.
 */
import { expect, type APIRequestContext } from "@playwright/test";

const MAILPIT = "http://localhost:8025";

/** Espera el correo más reciente enviado a `to` y devuelve su texto. */
export async function readLatestEmail(request: APIRequestContext, to: string): Promise<string> {
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
