/**
 * SOLO PARA DESARROLLO: aprueba todas las computadoras pendientes de la base local, para
 * poder entrar como administrador o superadministrador mientras se programa la pantalla del
 * superadministrador (sprint 3). Uso: `npm run dev:aprobar-computadoras`.
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
  const { count } = await prisma.authorizedDevice.updateMany({
    where: { status: "PENDING" },
    data: { status: "APPROVED", approvedById: superadmin?.id ?? null, approvedAt: new Date() },
  });
  console.log(`Computadoras aprobadas: ${count}`);
}

main().finally(() => prisma.$disconnect());
