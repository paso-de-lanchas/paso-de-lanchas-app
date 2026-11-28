/**
 * Repositorio de credenciales QR contra PostgreSQL (incluye el índice único parcial
 * de "una credencial vigente por pasajero").
 * Requieren `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaQrRepository } from "@/infrastructure/qr/prisma-qr-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

describe.skipIf(!prisma)("repositorio de credenciales QR", () => {
  const db = prisma!;
  const repository = createPrismaQrRepository(db);
  const suffix = Date.now().toString(36);
  let userId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `qr-${suffix}@pasolanchas.test`,
        fullName: "Pasajero QR de prueba",
        passwordHash: "x",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.qrCredential.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("replaceActive deja una sola credencial activa por pasajero", async () => {
    await repository.replaceActive(userId, "secreto-1");
    await repository.replaceActive(userId, "secreto-2");
    const third = await repository.replaceActive(userId, "secreto-3");

    const rows = await db.qrCredential.findMany({ where: { userId } });
    const active = rows.filter((r) => r.revokedAt === null);

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(third.id);
  });

  it("findActiveById ignora las credenciales revocadas", async () => {
    const first = await repository.replaceActive(userId, "secreto-a");
    const second = await repository.replaceActive(userId, "secreto-b");

    expect(await repository.findActiveById(first.id)).toBeNull();
    expect(await repository.findActiveById(second.id)).toEqual({
      id: second.id,
      userId,
      encryptedSecret: "secreto-b",
    });
  });

  it("un id que no es UUID da null sin lanzar error", async () => {
    expect(await repository.findActiveById("no-soy-un-uuid")).toBeNull();
  });
});
