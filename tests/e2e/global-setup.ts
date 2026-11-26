import { execFileSync } from "node:child_process";

/** Antes de las pruebas de navegador: prepara las cuentas de prueba en la base local. */
export default function globalSetup() {
  execFileSync("npx", ["tsx", "scripts/dev-prepare-e2e-accounts.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
