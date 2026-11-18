// Aplica las migraciones a la base de PRUEBAS (DATABASE_URL_TEST, puerto 5435).
// Uso: npm run db:test:prepare   (después de `docker compose up -d`)
import { execSync } from "node:child_process";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error("Falta DATABASE_URL_TEST en tu .env.local (cópiala de .env.example).");
  process.exit(1);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
