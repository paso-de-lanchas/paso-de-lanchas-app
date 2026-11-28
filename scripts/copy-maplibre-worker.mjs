// Copia el worker de MapLibre a public/vendor/ para servirlo como archivo estático.
// Corre solo antes de `npm run dev` y `npm run build` (predev / prebuild). El archivo copiado
// no se sube al repo (.gitignore): siempre sale de la versión instalada en node_modules.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve("maplibre-gl/package.json")),
  "dist",
  "maplibre-gl-worker.mjs",
);
const target = join("public", "vendor", "maplibre-gl-worker.mjs");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
