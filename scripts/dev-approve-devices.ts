/**
 * SOLO PARA DESARROLLO: aprueba las computadoras pendientes de la base local, para entrar como
 * administrador o superadministrador sin pasar por la pantalla del superadministrador
 * (`/superadmin/computadoras`, issue #42). Uso: `npm run dev:aprobar-computadoras` (todas) o
 * `npm run dev:aprobar-computadoras -- correo@pasolanchas.test` (solo las de esa cuenta; así
 * lo usan las pruebas de navegador para no aprobar las solicitudes de otras pruebas).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "db"].includes(host)) {
  console.error("Este script solo corre contra la base local de Docker. No se aprobó nada.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const superadmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
  const email = process.argv[2]?.trim().toLowerCase();
  const { count } = await prisma.authorizedDevice.updateMany({
    where: { status: "PENDING", ...(email ? { requestedBy: { email } } : {}) },
    data: { status: "APPROVED", approvedById: superadmin?.id ?? null, approvedAt: new Date() },
  });
  console.log(`Computadoras aprobadas: ${count}`);
}

main().finally(() => prisma.$disconnect());
