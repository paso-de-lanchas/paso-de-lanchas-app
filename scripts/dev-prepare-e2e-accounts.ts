/**
 * SOLO PARA PRUEBAS DE NAVEGADOR: deja listas en la base local de Docker las cuentas que usan
 * las pruebas de contraseña (tests/e2e/contrasena.spec.ts). Playwright lo corre una vez antes
 * de empezar (tests/e2e/global-setup.ts). Cada vez restablece su contraseña y borra sus
 * enlaces y sesiones, para poder correr las pruebas las veces que sea.
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { E2E_ACCOUNTS } from "../tests/e2e/accounts";

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
  console.error("Este script solo corre contra la base local de Docker. No se cambió nada.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  for (const account of Object.values(E2E_ACCOUNTS)) {
    const data = {
      fullName: "Cuenta de prueba",
      passwordHash: await hash(account.password),
      role: account.role,
      status: "ACTIVE" as const,
      emailVerifiedAt: new Date(),
      mustChangePassword: account.mustChangePassword,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        ...data,
        ...(account.role === "PASSENGER" ? { wallet: { create: {} } } : {}),
      },
      update: data,
    });
    await prisma.authToken.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }
  console.log(`Cuentas de prueba listas: ${Object.keys(E2E_ACCOUNTS).length}`);
}

main().finally(() => prisma.$disconnect());
