import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Carga DATABASE_URL_TEST (y demás) de .env.local para las pruebas de integración.
config({ path: ".env.local", quiet: true });

// Pruebas unitarias y de integración: `npm test`.
// Las pruebas viven junto al código: src/**/algo.test.ts
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/application/**"],
      exclude: ["**/*.test.ts", "src/application/shared/ports.ts"],
      // Definición de Hecho: ≥ 80 % en dominio y casos de uso.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
